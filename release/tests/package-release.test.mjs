import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  checkInputs,
  createDraft,
  createTag,
  validateEvidenceSnapshot,
  validatePublication,
  validateReleaseNotes,
} from "../package-release.mjs";

const candidate = JSON.parse(readFileSync(new URL("../candidate.json", import.meta.url), "utf8"));
const publication = JSON.parse(readFileSync(new URL("../publication.json", import.meta.url), "utf8"));
const TOKEN = "t".repeat(40);
const COMMIT = "a".repeat(40);

function clone(value) {
  return structuredClone(value);
}

function jsonResponse(status, body, headers = {}) {
  return new Response(body === null ? "" : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function tagObject(commit = COMMIT, sha = "b".repeat(40)) {
  return {
    sha,
    tag: publication.tagName,
    message:
      "Jumpgate coordinated release\n\n" +
      `Version: ${publication.coordinatedVersion}\n` +
      `Commit: ${commit}\n` +
      "Candidate: release/candidate.json\n" +
      "Evidence: release/evidence/physical-uat.json",
    object: { type: "commit", sha: commit },
  };
}

function tagRef(commit = COMMIT, sha = "b".repeat(40)) {
  return {
    ref: `refs/tags/${publication.tagName}`,
    object: {
      type: "tag",
      sha,
      url: `https://api.github.com/repos/ruizkinio/Jumpgate/git/tags/${sha}`,
    },
    _commit: commit,
  };
}

function releaseAsset(descriptor, id = descriptor.id) {
  return {
    id,
    url: `https://api.github.com/repos/ruizkinio/Jumpgate/releases/assets/${id}`,
    name: descriptor.name,
    size: descriptor.size,
    content_type: descriptor.contentType,
    state: "uploaded",
    digest: `sha256:${descriptor.sha256}`,
  };
}

function finalNotes(overrides = {}) {
  const values = {
    kodiCommit: publication.source.commit,
    bridgeCommit: candidate.components.bridge.commit,
    bridgeDigest: candidate.components.bridge.imageDigest,
    arm64Hash: candidate.components.kodi.artifacts["arm64-v8a"].apkSha256,
    armv7Hash: candidate.components.kodi.artifacts["armeabi-v7a"].apkSha256,
    signer: "10625572b5f34c5125b030dd5ab5fd40bdcd263d0fa8e2073ddee70435970551",
    releaseUrl: `https://github.com/ruizkinio/Jumpgate/releases/tag/${publication.tagName}`,
    evidenceCommit: "e".repeat(40),
    ...overrides,
  };
  return `# Jumpgate 3.0.0

Kodi: ${values.kodiCommit}
Bridge: ${values.bridgeCommit}
Image: ${values.bridgeDigest}
APK: ${values.arm64Hash}
APK: ${values.armv7Hash}
Signer: ${values.signer}
Release: ${values.releaseUrl}
Evidence: https://github.com/ruizkinio/Jumpgate/blob/${values.evidenceCommit}/release/evidence/physical-uat.json
`;
}

function rootRelease({ id = 91, assets = [], draft = true, body = finalNotes() } = {}) {
  return {
    id,
    tag_name: publication.tagName,
    target_commitish: COMMIT,
    name: publication.releaseName,
    body,
    draft,
    prerelease: false,
    upload_url: `https://uploads.github.com/repos/ruizkinio/Jumpgate/releases/${id}/assets{?name,label}`,
    assets,
  };
}

function withFetch(handler, action) {
  const previous = globalThis.fetch;
  globalThis.fetch = handler;
  return Promise.resolve()
    .then(action)
    .finally(() => {
      globalThis.fetch = previous;
    });
}

test("publication metadata is exact and candidate-bound", () => {
  assert.equal(validatePublication(clone(publication), candidate).tagName, "v3.0.0");
  const mutations = [
    (value) => { value.extra = true; },
    (value) => { value.tagName = "v3.0.1"; },
    (value) => { value.source.commit = "0".repeat(40); },
    (value) => { value.source.assets[0].sha256 = "0".repeat(64); },
    (value) => { value.source.assets[1].name = value.source.assets[0].name; },
    (value) => { value.source.assets[5].attested = true; },
    (value) => { value.source.assets.pop(); },
  ];
  for (const mutate of mutations) {
    const value = clone(publication);
    mutate(value);
    assert.throws(() => validatePublication(value, candidate));
  }
});

test("release inputs require exact head, immutable UAT evidence, and all locked facts", () => {
  const notes = finalNotes();
  assert.equal(checkInputs(publication, candidate, notes, COMMIT, COMMIT), COMMIT);
  assert.equal(validateReleaseNotes(notes, publication, candidate), notes);
  assert.throws(
    () => checkInputs(publication, candidate, notes, COMMIT, "b".repeat(40)),
    /exact checked-out commit/,
  );
  const invalidNotes = [
    finalNotes({ evidenceCommit: "main" }),
    finalNotes({ releaseUrl: "https://github.com/ruizkinio/Jumpgate/releases" }),
    finalNotes({ kodiCommit: "0".repeat(40) }),
    finalNotes({ arm64Hash: "0".repeat(64) }),
    `# Jumpgate 3.0.0\n\nRelease-owner draft: Do not publish.\n${notes}`,
  ];
  for (const value of invalidNotes) {
    assert.throws(() => validateReleaseNotes(value, publication, candidate));
  }
  assert.equal(
    validateEvidenceSnapshot(notes, Buffer.from("evidence"), Buffer.from("evidence"), true),
    "e".repeat(40),
  );
  assert.throws(
    () => validateEvidenceSnapshot(notes, Buffer.from("evidence"), Buffer.from("changed"), true),
    /exact committed physical UAT evidence snapshot/,
  );
  assert.throws(
    () => validateEvidenceSnapshot(notes, Buffer.from("evidence"), Buffer.from("evidence"), false),
    /exact committed physical UAT evidence snapshot/,
  );
});

test("tag creation accepts only an exact owned tag and never overwrites", async () => {
  const calls = [];
  let created = false;
  await withFetch(async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET", body: options.body });
    if (String(url).includes("/releases?")) return jsonResponse(200, []);
    if (String(url).includes("/git/ref/tags/")) {
      return created ? jsonResponse(200, tagRef(COMMIT)) : jsonResponse(404, { message: "Not Found" });
    }
    if (String(url).endsWith("/git/tags")) {
      const body = JSON.parse(options.body);
      assert.equal(body.object, COMMIT);
      assert.equal(body.type, "commit");
      return jsonResponse(201, tagObject(COMMIT));
    }
    if (String(url).endsWith("/git/refs")) {
      created = true;
      return jsonResponse(201, tagRef(COMMIT));
    }
    if (String(url).includes("/git/tags/")) return jsonResponse(200, tagObject(COMMIT));
    assert.fail(`unexpected request: ${url}`);
  }, () => createTag(publication, TOKEN, COMMIT));
  assert.deepEqual(calls.map((call) => call.method), ["GET", "GET", "POST", "POST", "GET", "GET"]);

  await withFetch(async (url) => {
    if (String(url).includes("/releases?")) return jsonResponse(200, [rootRelease({ draft: false })]);
    assert.fail("public release must stop before tag mutation");
  }, () => assert.rejects(createTag(publication, TOKEN, COMMIT), /state changed/));

  await withFetch(async (url) => {
    if (String(url).includes("/releases?")) return jsonResponse(200, []);
    if (String(url).includes("/git/ref/tags/")) return jsonResponse(200, tagRef(COMMIT, "c".repeat(40)));
    if (String(url).includes("/git/tags/")) return jsonResponse(200, tagObject("d".repeat(40), "c".repeat(40)));
    assert.fail(`unexpected request: ${url}`);
  }, () => assert.rejects(createTag(publication, TOKEN, COMMIT), /not the exact workflow-owned tag/));
});

test("draft creation resumes only exact assets and revalidates final state", async () => {
  const directory = mkdtempSync(resolve(tmpdir(), "jumpgate-package-test-"));
  const notes = resolve(directory, "notes.md");
  const uploaded = [releaseAsset(publication.source.assets[0], 501)];
  const release = rootRelease({ assets: uploaded });
  try {
    const notesBody = finalNotes();
    writeFileSync(notes, notesBody);
    // Use tiny deterministic files; the production descriptors retain their real sizes.
    const fixture = clone(publication);
    for (const descriptor of fixture.source.assets) {
      const bytes = Buffer.from(`fixture:${descriptor.name}\n`);
      descriptor.size = bytes.length;
      descriptor.sha256 = createHash("sha256").update(bytes).digest("hex");
      writeFileSync(resolve(directory, descriptor.name), bytes);
    }
    const existing = releaseAsset(fixture.source.assets[0], 501);
    release.assets = [existing];
    release.body = notesBody;
    const rootAssets = new Map([[existing.name, existing]]);
    const calls = [];
    await withFetch(async (url, options = {}) => {
      const target = String(url);
      calls.push({ target, method: options.method || "GET" });
      if (target.includes("/git/ref/tags/")) return jsonResponse(200, tagRef(COMMIT));
      if (target.includes("/git/tags/")) return jsonResponse(200, tagObject(COMMIT));
      if (target.includes("/releases?")) return jsonResponse(200, [release]);
      if (target.includes("/releases/assets/")) {
        const id = Number(target.split("/").at(-1));
        const observed = [...rootAssets.values()].find((asset) => asset.id === id);
        return observed ? jsonResponse(200, observed) : jsonResponse(404, { message: "Not Found" });
      }
      if (target.startsWith("https://uploads.github.com/")) {
        const name = new URL(target).searchParams.get("name");
        const descriptor = fixture.source.assets.find((asset) => asset.name === name);
        const asset = releaseAsset(descriptor, 600 + rootAssets.size);
        rootAssets.set(name, asset);
        release.assets = [...rootAssets.values()];
        return jsonResponse(201, asset);
      }
      if (target.endsWith(`/releases/${release.id}`)) return jsonResponse(200, release);
      assert.fail(`unexpected request: ${target}`);
    }, () => createDraft(fixture, candidate, TOKEN, COMMIT, directory, notes));
    assert.equal(rootAssets.size, 7);
    assert.equal(calls.filter((call) => call.method === "POST").length, 6);
    assert.equal(calls.filter((call) => call.target.includes("/git/ref/tags/")).length, 2);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("draft creation rejects placeholders, public state, and foreign assets", async () => {
  const directory = mkdtempSync(resolve(tmpdir(), "jumpgate-package-negative-"));
  const notes = resolve(directory, "notes.md");
  try {
    writeFileSync(notes, "# Jumpgate\n\n{{UAT_EVIDENCE_URL}}\n");
    await withFetch(async (url) => {
      const target = String(url);
      if (target.includes("/git/ref/tags/")) return jsonResponse(200, tagRef(COMMIT));
      if (target.includes("/git/tags/")) return jsonResponse(200, tagObject(COMMIT));
      if (target.includes("/releases?")) return jsonResponse(200, []);
      assert.fail(`unexpected request: ${target}`);
    }, () => assert.rejects(createDraft(publication, candidate, TOKEN, COMMIT, directory, notes), /placeholder/));

    writeFileSync(notes, finalNotes());
    const publicRelease = rootRelease({ draft: false });
    await withFetch(async (url) => {
      const target = String(url);
      if (target.includes("/git/ref/tags/")) return jsonResponse(200, tagRef(COMMIT));
      if (target.includes("/git/tags/")) return jsonResponse(200, tagObject(COMMIT));
      if (target.includes("/releases?")) return jsonResponse(200, [publicRelease]);
      assert.fail(`unexpected request: ${target}`);
    }, () => assert.rejects(createDraft(publication, candidate, TOKEN, COMMIT, directory, notes), /state changed/));

    const foreign = rootRelease({
      assets: [{ ...releaseAsset(publication.source.assets[0]), name: "unexpected.bin" }],
    });
    await withFetch(async (url) => {
      const target = String(url);
      if (target.includes("/git/ref/tags/")) return jsonResponse(200, tagRef(COMMIT));
      if (target.includes("/git/tags/")) return jsonResponse(200, tagObject(COMMIT));
      if (target.includes("/releases?")) return jsonResponse(200, [foreign]);
      assert.fail(`unexpected request: ${target}`);
    }, () => assert.rejects(createDraft(publication, candidate, TOKEN, COMMIT, directory, notes), /unexpected or drifted/));

    const staleBody = rootRelease({ body: `${finalNotes()}\nChanged after validation.\n` });
    await withFetch(async (url) => {
      const target = String(url);
      if (target.includes("/git/ref/tags/")) return jsonResponse(200, tagRef(COMMIT));
      if (target.includes("/git/tags/")) return jsonResponse(200, tagObject(COMMIT));
      if (target.includes("/releases?")) return jsonResponse(200, [staleBody]);
      assert.fail(`unexpected request: ${target}`);
    }, () => assert.rejects(
      createDraft(publication, candidate, TOKEN, COMMIT, directory, notes),
      /identity or state changed/,
    ));

    const foreignUpload = rootRelease();
    foreignUpload.upload_url = "https://uploads.example.test/assets{?name,label}";
    await withFetch(async (url) => {
      const target = String(url);
      if (target.includes("/git/ref/tags/")) return jsonResponse(200, tagRef(COMMIT));
      if (target.includes("/git/tags/")) return jsonResponse(200, tagObject(COMMIT));
      if (target.includes("/releases?")) return jsonResponse(200, [foreignUpload]);
      assert.fail(`unexpected request: ${target}`);
    }, () => assert.rejects(
      createDraft(publication, candidate, TOKEN, COMMIT, directory, notes),
      /identity or state changed/,
    ));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
