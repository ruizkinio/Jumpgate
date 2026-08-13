#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  createWriteStream,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const ROOT_REPOSITORY = "ruizkinio/Jumpgate";
const HASH = /^[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const TAG = /^v[0-9]+\.[0-9]+\.[0-9]+$/;
const ASSET_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const MAX_ASSET_BYTES = 200 * 1024 * 1024;
const MAX_RELEASES = 100;
const TAG_MESSAGE_PREFIX = "Jumpgate coordinated release\n\n";
const PACKAGE_DIRECTORY = ".release/payload";

function fail(message) {
  throw new Error(message);
}

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys, label) {
  if (!plainObject(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.join("\n") !== expected.join("\n")) fail(`${label} has unexpected fields`);
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) fail(`${label} must be a positive integer`);
}

export function validatePublication(value, candidate) {
  exactKeys(
    value,
    ["schemaVersion", "coordinatedVersion", "tagName", "releaseName", "releaseNotesPath", "source"],
    "publication",
  );
  if (
    value.schemaVersion !== 1 ||
    value.coordinatedVersion !== candidate.coordinatedVersion ||
    value.tagName !== `v${candidate.coordinatedVersion}` ||
    !TAG.test(value.tagName) ||
    value.releaseName !== `Jumpgate ${candidate.coordinatedVersion}` ||
    value.releaseNotesPath !== "docs/RELEASE_NOTES_DRAFT.md"
  ) {
    fail("publication identity does not match the coordinated candidate");
  }
  const source = value.source;
  exactKeys(
    source,
    ["repository", "releaseId", "tagObject", "tagName", "commit", "runId", "workflowPath", "assets"],
    "publication.source",
  );
  positiveInteger(source.releaseId, "publication.source.releaseId");
  positiveInteger(source.runId, "publication.source.runId");
  if (
    source.repository !== "ruizkinio/Jumpgate-kodi" ||
    !SHA.test(source.tagObject) ||
    source.tagName !== value.tagName ||
    source.commit !== candidate.components.kodi.commit ||
    source.runId !== Number(candidate.components.kodi.provenance.runUrl.split("/").at(-1)) ||
    source.workflowPath !== ".github/workflows/jumpgate-android-release.yml" ||
    !Array.isArray(source.assets) ||
    source.assets.length !== 7
  ) {
    fail("publication source does not match the locked Kodi candidate");
  }
  const names = new Set();
  const ids = new Set();
  for (const [index, asset] of source.assets.entries()) {
    const label = `publication.source.assets[${index}]`;
    exactKeys(asset, ["id", "name", "size", "contentType", "sha256", "attested"], label);
    positiveInteger(asset.id, `${label}.id`);
    positiveInteger(asset.size, `${label}.size`);
    if (
      asset.size > MAX_ASSET_BYTES ||
      !ASSET_NAME.test(asset.name) ||
      !["application/vnd.android.package-archive", "application/octet-stream"].includes(asset.contentType) ||
      !HASH.test(asset.sha256) ||
      typeof asset.attested !== "boolean" ||
      names.has(asset.name) ||
      ids.has(asset.id)
    ) {
      fail(`${label} is invalid or duplicated`);
    }
    names.add(asset.name);
    ids.add(asset.id);
  }
  const expectedNames = [
    `Jumpgate-22.0-ALPHA2-Jumpgate-${value.coordinatedVersion}-arm64-v8a.apk`,
    `Jumpgate-22.0-ALPHA2-Jumpgate-${value.coordinatedVersion}-arm64-v8a.spdx.json`,
    `Jumpgate-22.0-ALPHA2-Jumpgate-${value.coordinatedVersion}-armeabi-v7a.apk`,
    `Jumpgate-22.0-ALPHA2-Jumpgate-${value.coordinatedVersion}-armeabi-v7a.spdx.json`,
    `Jumpgate-22.0-ALPHA2-Jumpgate-${value.coordinatedVersion}-metadata.json`,
    `Jumpgate-22.0-ALPHA2-Jumpgate-${value.coordinatedVersion}-provenance.json`,
    "SHA256SUMS",
  ].sort();
  if ([...names].sort().join("\n") !== expectedNames.join("\n")) {
    fail("publication source asset inventory is not exact");
  }
  for (const [abi, candidateArtifact] of Object.entries(candidate.components.kodi.artifacts)) {
    const apk = source.assets.find((asset) => asset.name.endsWith(`-${abi}.apk`));
    if (!apk || apk.sha256 !== candidateArtifact.apkSha256 || !apk.attested) {
      fail(`publication ${abi} APK does not match the candidate`);
    }
  }
  const provenance = source.assets.find((asset) => asset.name.endsWith("-provenance.json"));
  if (!provenance || provenance.attested) fail("the provenance bundle must not attest itself");
  if (source.assets.filter((asset) => asset.attested).length !== 6) {
    fail("exactly six source assets must be bound by provenance");
  }
  return value;
}

export function validateReleaseNotes(notes, publication, candidate) {
  if (
    typeof notes !== "string" ||
    Buffer.byteLength(notes, "utf8") > 128 * 1024 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(notes) ||
    !notes.startsWith(`# Jumpgate ${publication.coordinatedVersion}\n`) ||
    /\{\{[A-Z0-9_]+\}\}|Release-owner draft|Do not publish|Publication Gate/i.test(notes)
  ) {
    fail("release notes still contain a draft warning, placeholder, or invalid content");
  }
  const required = [
    publication.source.commit,
    candidate.components.bridge.commit,
    candidate.components.bridge.imageDigest,
    ...Object.values(candidate.components.kodi.artifacts).map((artifact) => artifact.apkSha256),
    "10625572b5f34c5125b030dd5ab5fd40bdcd263d0fa8e2073ddee70435970551",
    `https://github.com/${ROOT_REPOSITORY}/releases/tag/${publication.tagName}`,
    `https://github.com/${ROOT_REPOSITORY}/blob/`,
    "/release/evidence/physical-uat.json",
  ];
  if (required.some((value) => !notes.includes(value))) {
    fail("release notes do not bind every final release fact");
  }
  const evidenceUrls = [...notes.matchAll(
    /https:\/\/github\.com\/ruizkinio\/Jumpgate\/blob\/([a-f0-9]{40})\/release\/evidence\/physical-uat\.json/g,
  )];
  if (evidenceUrls.length !== 1) fail("release notes require exactly one immutable physical UAT evidence URL");
  return notes;
}

export function validateEvidenceSnapshot(notes, currentBytes, immutableBytes, isAncestor) {
  const matches = [...notes.matchAll(
    /https:\/\/github\.com\/ruizkinio\/Jumpgate\/blob\/([a-f0-9]{40})\/release\/evidence\/physical-uat\.json/g,
  )];
  if (
    matches.length !== 1 ||
    isAncestor !== true ||
    !Buffer.isBuffer(currentBytes) ||
    !Buffer.isBuffer(immutableBytes) ||
    !currentBytes.equals(immutableBytes)
  ) {
    fail("release notes do not bind the exact committed physical UAT evidence snapshot");
  }
  return matches[0][1];
}

export function checkInputs(publication, candidate, notes, commit, currentCommit) {
  if (!SHA.test(commit) || !SHA.test(currentCommit) || commit !== currentCommit) {
    fail("coordinated commit must match the exact checked-out commit");
  }
  validatePublication(publication, candidate);
  validateReleaseNotes(notes, publication, candidate);
  return commit;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalTagMessage(publication, commit) {
  return (
    TAG_MESSAGE_PREFIX +
    `Version: ${publication.coordinatedVersion}\n` +
    `Commit: ${commit}\n` +
    `Candidate: release/candidate.json\n` +
    `Evidence: release/evidence/physical-uat.json`
  );
}

function authHeaders(token, contentType = "application/vnd.github+json") {
  if (typeof token !== "string" || token.length < 20 || /[\r\n]/.test(token)) fail("token is invalid");
  return {
    Accept: contentType,
    Authorization: `Bearer ${token}`,
    "User-Agent": "jumpgate-coordinated-release/1",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function apiJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...authHeaders(token), ...(options.headers || {}) },
    redirect: "error",
  });
  const text = await response.text();
  if (!response.ok) fail(`GitHub API request failed with HTTP ${response.status}`);
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    fail("GitHub API response was not valid JSON");
  }
}

function assertSourceRelease(release, publication) {
  const source = publication.source;
  if (
    !plainObject(release) ||
    release.id !== source.releaseId ||
    release.tag_name !== source.tagName ||
    release.target_commitish !== source.commit ||
    release.draft !== true ||
    release.prerelease !== false ||
    !Array.isArray(release.assets) ||
    release.assets.length !== source.assets.length
  ) {
    fail("source Kodi release identity or state changed");
  }
  const expected = new Map(source.assets.map((asset) => [asset.name, asset]));
  for (const observed of release.assets) {
    const descriptor = expected.get(observed?.name);
    if (
      !descriptor ||
      observed.id !== descriptor.id ||
      observed.size !== descriptor.size ||
      observed.content_type !== descriptor.contentType ||
      observed.state !== "uploaded" ||
      observed.digest !== `sha256:${descriptor.sha256}`
    ) {
      fail("source Kodi release asset binding changed");
    }
    expected.delete(observed.name);
  }
  if (expected.size) fail("source Kodi release asset inventory is incomplete");
  return release;
}

function assertSourceTag(tag, publication) {
  if (
    !plainObject(tag) ||
    tag.sha !== publication.source.tagObject ||
    tag.tag !== publication.source.tagName ||
    tag.object?.type !== "commit" ||
    tag.object?.sha !== publication.source.commit
  ) {
    fail("source Kodi annotated tag binding changed");
  }
  return tag;
}

async function downloadAsset(asset, token, destination) {
  const apiUrl = `https://api.github.com/repos/${asset.repository}/releases/assets/${asset.id}`;
  let response = await fetch(apiUrl, {
    headers: authHeaders(token, "application/octet-stream"),
    redirect: "manual",
  });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    let target;
    try {
      target = new URL(location);
    } catch {
      fail("source asset redirect was invalid");
    }
    if (
      target.protocol !== "https:" ||
      target.username ||
      target.password ||
      target.hash ||
      !/^(?:release-assets|objects)\.githubusercontent\.com$/.test(target.hostname)
    ) {
      fail("source asset redirect left the approved GitHub asset boundary");
    }
    response = await fetch(target, {
      headers: { "User-Agent": "jumpgate-coordinated-release/1" },
      redirect: "error",
    });
  }
  if (!response.ok || !response.body) fail(`source asset download failed with HTTP ${response.status}`);
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared !== asset.size) fail("source asset length changed");
  let received = 0;
  const hash = createHash("sha256");
  const meter = new TransformStream({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > asset.size || received > MAX_ASSET_BYTES) fail("source asset exceeded its bound");
      hash.update(chunk);
      controller.enqueue(chunk);
    },
  });
  mkdirSync(dirname(destination), { recursive: true });
  await pipeline(Readable.fromWeb(response.body.pipeThrough(meter)), createWriteStream(destination, { flags: "wx", mode: 0o600 }));
  if (received !== asset.size || hash.digest("hex") !== asset.sha256) fail("downloaded source asset bytes changed");
}

function validateMetadata(metadata, publication, candidate) {
  if (
    metadata?.schemaVersion !== 1 ||
    metadata.product !== "Jumpgate" ||
    metadata.platform !== "android" ||
    metadata.license !== "GPL-2.0-or-later" ||
    metadata.releaseTag !== publication.tagName ||
    metadata.source?.commit !== publication.source.commit ||
    metadata.source?.reviewedRef !== publication.source.commit ||
    metadata.githubActions?.runId !== publication.source.runId ||
    metadata.githubActions?.runAttempt !== 1 ||
    metadata.android?.packageName !== "io.github.ruizkinio.jumpgate" ||
    metadata.android?.versionName !== "22.0-ALPHA2-Jumpgate-3.0.0" ||
    metadata.android?.versionCode !== 2200300 ||
    metadata.android?.signerCertificateSha256 !==
      "10625572b5f34c5125b030dd5ab5fd40bdcd263d0fa8e2073ddee70435970551" ||
    !Array.isArray(metadata.artifacts) ||
    metadata.artifacts.length !== 2
  ) {
    fail("source release metadata does not match publication policy");
  }
  for (const record of metadata.artifacts) {
    const descriptor = publication.source.assets.find((asset) => asset.name === record?.name);
    const candidateArtifact = candidate.components.kodi.artifacts[record?.abi];
    const sbom = publication.source.assets.find((asset) => asset.name === record?.sbom?.name);
    if (
      !descriptor ||
      !candidateArtifact ||
      !sbom ||
      record.sha256 !== descriptor.sha256 ||
      record.sha256 !== candidateArtifact.apkSha256 ||
      record.size !== descriptor.size ||
      record.mediaType !== descriptor.contentType ||
      record.sbom?.format !== "SPDX-2.3" ||
      record.sbom?.sha256 !== sbom.sha256 ||
      record.sbom?.size !== sbom.size
    ) {
      fail("source release metadata artifact binding changed");
    }
  }
}

function validateSbom(sbom, descriptor, version) {
  const matching = Array.isArray(sbom?.packages)
    ? sbom.packages.filter((record) => record?.name === descriptor.name)
    : [];
  if (
    sbom?.spdxVersion !== "SPDX-2.3" ||
    sbom?.dataLicense !== "CC0-1.0" ||
    sbom?.name !== descriptor.name.replace(/\.spdx\.json$/, ".apk") ||
    !Array.isArray(sbom?.creationInfo?.creators) ||
    !sbom.creationInfo.creators.includes("Tool: syft-1.46.0") ||
    matching.length !== 2 ||
    matching.some(
      (record) =>
        record.versionInfo !== version ||
        !record.checksums?.some(
          (checksum) => checksum.algorithm === "SHA256" && checksum.checksumValue === descriptor.sha256,
        ),
    )
  ) {
    fail(`source SBOM is malformed: ${descriptor.name}`);
  }
}

function verifyProvenance(directory, publication) {
  const bundle = resolve(
    directory,
    publication.source.assets.find((asset) => asset.name.endsWith("-provenance.json")).name,
  );
  for (const asset of publication.source.assets.filter((entry) => entry.attested)) {
    execFileSync(
      "gh",
      [
        "attestation",
        "verify",
        resolve(directory, asset.name),
        "--bundle",
        bundle,
        "--repo",
        publication.source.repository,
        "--signer-workflow",
        `${publication.source.repository}/${publication.source.workflowPath}`,
        "--source-digest",
        publication.source.commit,
        "--source-ref",
        "refs/heads/master",
        "--deny-self-hosted-runners",
        "--limit",
        "1",
        "--format",
        "json",
      ],
      { stdio: ["ignore", "ignore", "pipe"], maxBuffer: 16 * 1024 * 1024 },
    );
  }
}

export async function prepare(publication, candidate, sourceToken, directory) {
  const release = await apiJson(
    `https://api.github.com/repos/${publication.source.repository}/releases/${publication.source.releaseId}`,
    sourceToken,
  );
  assertSourceRelease(release, publication);
  const tag = await apiJson(
    `https://api.github.com/repos/${publication.source.repository}/git/tags/${publication.source.tagObject}`,
    sourceToken,
  );
  assertSourceTag(tag, publication);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try {
    for (const descriptor of publication.source.assets) {
      await downloadAsset(
        { ...descriptor, repository: publication.source.repository },
        sourceToken,
        resolve(directory, descriptor.name),
      );
    }
    const sumsDescriptor = publication.source.assets.find((asset) => asset.name === "SHA256SUMS");
    const expectedSums = publication.source.assets
      .filter((asset) => asset.name !== "SHA256SUMS" && !asset.name.endsWith("-provenance.json"))
      .map((asset) => `${asset.sha256}  ${asset.name}`)
      .join("\n") + "\n";
    const sums = readFileSync(resolve(directory, sumsDescriptor.name), "utf8");
    if (sums !== expectedSums) fail("source SHA256SUMS content changed");
    const metadataDescriptor = publication.source.assets.find((asset) => asset.name.endsWith("-metadata.json"));
    validateMetadata(
      JSON.parse(readFileSync(resolve(directory, metadataDescriptor.name), "utf8")),
      publication,
      candidate,
    );
    for (const descriptor of publication.source.assets.filter((asset) => asset.name.endsWith(".spdx.json"))) {
      const apk = publication.source.assets.find(
        (asset) => asset.name === descriptor.name.replace(/\.spdx\.json$/, ".apk"),
      );
      validateSbom(
        JSON.parse(readFileSync(resolve(directory, descriptor.name), "utf8")),
        { ...descriptor, name: apk.name, sha256: apk.sha256 },
        "22.0-ALPHA2-Jumpgate-3.0.0",
      );
    }
    verifyProvenance(directory, publication);
    for (const descriptor of publication.source.assets) {
      chmodSync(resolve(directory, descriptor.name), 0o400);
    }
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

async function listRootReleases(token) {
  const releases = await apiJson(
    `https://api.github.com/repos/${ROOT_REPOSITORY}/releases?per_page=${MAX_RELEASES}&page=1`,
    token,
  );
  if (!Array.isArray(releases) || releases.length >= MAX_RELEASES) {
    fail("root release inventory is invalid or exceeds one bounded page");
  }
  const tags = new Set();
  for (const release of releases) {
    if (typeof release?.tag_name !== "string" || !TAG.test(release.tag_name) || tags.has(release.tag_name)) {
      fail("root release inventory contains an invalid or duplicate canonical tag");
    }
    tags.add(release.tag_name);
  }
  return releases;
}

async function getRootTag(token, tagName) {
  const response = await fetch(
    `https://api.github.com/repos/${ROOT_REPOSITORY}/git/ref/tags/${encodeURIComponent(tagName)}`,
    { headers: authHeaders(token), redirect: "error" },
  );
  if (response.status === 404) return null;
  const text = await response.text();
  if (!response.ok) fail(`root tag lookup failed with HTTP ${response.status}`);
  try {
    return JSON.parse(text);
  } catch {
    fail("root tag lookup returned invalid JSON");
  }
}

async function assertOwnedRootTag(token, publication, commit) {
  const ref = await getRootTag(token, publication.tagName);
  if (!ref || ref.ref !== `refs/tags/${publication.tagName}` || ref.object?.type !== "tag") {
    fail("coordinated release tag is absent or not annotated");
  }
  const tag = await apiJson(ref.object.url, token);
  if (
    tag?.sha !== ref.object.sha ||
    tag?.tag !== publication.tagName ||
    tag?.object?.type !== "commit" ||
    tag?.object?.sha !== commit ||
    tag?.message !== canonicalTagMessage(publication, commit)
  ) {
    fail("coordinated release tag is not the exact workflow-owned tag");
  }
  return tag;
}

export async function createTag(publication, token, commit) {
  if (!SHA.test(commit)) fail("coordinated commit is invalid");
  const releases = await listRootReleases(token);
  const matchingReleases = releases.filter((release) => release.tag_name === publication.tagName);
  if (matchingReleases.length > 1) fail("duplicate coordinated releases exist for the target tag");
  if (matchingReleases.length === 1) {
    assertRootRelease(matchingReleases[0], publication, commit);
    return assertOwnedRootTag(token, publication, commit);
  }
  const existing = await getRootTag(token, publication.tagName);
  if (existing) return assertOwnedRootTag(token, publication, commit);
  const tag = await apiJson(`https://api.github.com/repos/${ROOT_REPOSITORY}/git/tags`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tag: publication.tagName,
      message: canonicalTagMessage(publication, commit),
      object: commit,
      type: "commit",
    }),
  });
  if (tag?.tag !== publication.tagName || tag?.object?.sha !== commit || tag?.object?.type !== "commit") {
    fail("GitHub created an unexpected annotated tag object");
  }
  const ref = await apiJson(`https://api.github.com/repos/${ROOT_REPOSITORY}/git/refs`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref: `refs/tags/${publication.tagName}`, sha: tag.sha }),
  });
  if (ref?.ref !== `refs/tags/${publication.tagName}` || ref?.object?.sha !== tag.sha) {
    fail("GitHub created an unexpected coordinated tag ref");
  }
  return assertOwnedRootTag(token, publication, commit);
}

function assertRootRelease(release, publication, commit, expectedBody = null) {
  if (
    !Number.isSafeInteger(release?.id) ||
    release.id < 1 ||
    release?.tag_name !== publication.tagName ||
    release?.target_commitish !== commit ||
    release?.name !== publication.releaseName ||
    release?.upload_url !==
      `https://uploads.github.com/repos/${ROOT_REPOSITORY}/releases/${release.id}/assets{?name,label}` ||
    release?.draft !== true ||
    release?.prerelease !== false ||
    (expectedBody !== null && release?.body !== expectedBody) ||
    !Array.isArray(release.assets)
  ) {
    fail("coordinated draft identity or state changed");
  }
  const expected = new Map(publication.source.assets.map((asset) => [asset.name, asset]));
  const assetIds = new Set();
  for (const asset of release.assets) {
    const descriptor = expected.get(asset?.name);
    if (
      !descriptor ||
      !Number.isSafeInteger(asset.id) ||
      asset.id < 1 ||
      assetIds.has(asset.id) ||
      asset.url !== `https://api.github.com/repos/${ROOT_REPOSITORY}/releases/assets/${asset.id}` ||
      asset.size !== descriptor.size ||
      asset.content_type !== descriptor.contentType ||
      asset.state !== "uploaded" ||
      asset.digest !== `sha256:${descriptor.sha256}`
    ) {
      fail("coordinated draft contains an unexpected or drifted asset");
    }
    assetIds.add(asset.id);
    expected.delete(asset.name);
  }
  return expected;
}

async function uploadAsset(uploadUrl, releaseId, descriptor, path, token) {
  const bytes = readFileSync(path);
  if (bytes.length !== descriptor.size || sha256(bytes) !== descriptor.sha256) {
    fail("prepared release asset changed before upload");
  }
  const url = `${uploadUrl.replace(/\{.*$/, "")}?name=${encodeURIComponent(descriptor.name)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(token, "application/vnd.github+json"),
      "Content-Type": descriptor.contentType,
      "Content-Length": String(bytes.length),
    },
    body: bytes,
    redirect: "error",
  });
  const text = await response.text();
  if (!response.ok) fail(`coordinated asset upload failed with HTTP ${response.status}`);
  let uploaded;
  try {
    uploaded = JSON.parse(text);
  } catch {
    fail("coordinated asset upload returned invalid JSON");
  }
  if (
    uploaded?.name !== descriptor.name ||
    uploaded?.size !== descriptor.size ||
    uploaded?.content_type !== descriptor.contentType ||
    uploaded?.state !== "uploaded" ||
    uploaded?.digest !== `sha256:${descriptor.sha256}` ||
    uploaded?.url !== `https://api.github.com/repos/${ROOT_REPOSITORY}/releases/assets/${uploaded.id}`
  ) {
    fail("uploaded coordinated asset binding is invalid");
  }
  const observed = await apiJson(
    `https://api.github.com/repos/${ROOT_REPOSITORY}/releases/assets/${uploaded.id}`,
    token,
  );
  if (
    observed?.name !== descriptor.name ||
    observed?.size !== descriptor.size ||
    observed?.content_type !== descriptor.contentType ||
    observed?.state !== "uploaded" ||
    observed?.digest !== `sha256:${descriptor.sha256}`
  ) {
    fail("uploaded coordinated asset could not be revalidated");
  }
  return releaseId;
}

export async function createDraft(publication, candidate, token, commit, directory, notesPath) {
  await assertOwnedRootTag(token, publication, commit);
  const notes = readFileSync(notesPath, "utf8");
  validateReleaseNotes(notes, publication, candidate);
  const releases = await listRootReleases(token);
  const matches = releases.filter((release) => release.tag_name === publication.tagName);
  if (matches.length > 1) fail("duplicate coordinated releases exist for the target tag");
  let release = matches[0] || null;
  if (!release) {
    release = await apiJson(`https://api.github.com/repos/${ROOT_REPOSITORY}/releases`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tag_name: publication.tagName,
        target_commitish: commit,
        name: publication.releaseName,
        body: notes,
        draft: true,
        prerelease: false,
        make_latest: "false",
      }),
    });
  }
  const missing = assertRootRelease(release, publication, commit, notes);
  for (const descriptor of publication.source.assets) {
    if (!missing.has(descriptor.name)) continue;
    await uploadAsset(
      release.upload_url,
      release.id,
      descriptor,
      resolve(directory, descriptor.name),
      token,
    );
  }
  const finalRelease = await apiJson(
    `https://api.github.com/repos/${ROOT_REPOSITORY}/releases/${release.id}`,
    token,
  );
  const finalMissing = assertRootRelease(finalRelease, publication, commit, notes);
  if (finalMissing.size || finalRelease.assets.length !== publication.source.assets.length) {
    fail("coordinated draft release asset inventory is incomplete");
  }
  await assertOwnedRootTag(token, publication, commit);
  return finalRelease;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`cannot read valid JSON from ${path}: ${error.message}`);
  }
}

function verifyCommittedEvidenceSnapshot(root, notes, currentCommit) {
  const match = notes.match(
    /https:\/\/github\.com\/ruizkinio\/Jumpgate\/blob\/([a-f0-9]{40})\/release\/evidence\/physical-uat\.json/,
  );
  const evidenceCommit = match?.[1] || "";
  let isAncestor = false;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", evidenceCommit, currentCommit], {
      cwd: root,
      stdio: ["ignore", "ignore", "pipe"],
    });
    isAncestor = true;
  } catch {
    // The immutable snapshot must be part of the exact coordinated commit's ancestry.
  }
  let immutableBytes = Buffer.alloc(0);
  try {
    immutableBytes = execFileSync(
      "git",
      ["show", `${evidenceCommit}:release/evidence/physical-uat.json`],
      { cwd: root, encoding: "buffer", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 2 * 1024 * 1024 },
    );
  } catch {
    // validateEvidenceSnapshot emits one bounded failure without exposing git output.
  }
  validateEvidenceSnapshot(
    notes,
    readFileSync(resolve(root, "release/evidence/physical-uat.json")),
    immutableBytes,
    isAncestor,
  );
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const candidate = readJson(resolve(root, "release/candidate.json"));
  const publication = validatePublication(
    readJson(resolve(root, "release/publication.json")),
    candidate,
  );
  if (command === "check-inputs" && args.length === 1) {
    const currentCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    const notes = readFileSync(resolve(root, publication.releaseNotesPath), "utf8");
    checkInputs(
      publication,
      candidate,
      notes,
      args[0],
      currentCommit,
    );
    verifyCommittedEvidenceSnapshot(root, notes, currentCommit);
    console.log("Verified finalized coordinated release inputs.");
    return;
  }
  if (command === "prepare" && args.length === 1) {
    if (args[0] !== PACKAGE_DIRECTORY) fail(`package directory must be ${PACKAGE_DIRECTORY}`);
    const token = process.env.SOURCE_GITHUB_TOKEN;
    await prepare(publication, candidate, token, resolve(root, PACKAGE_DIRECTORY));
    console.log("Prepared and verified the exact seven-asset Kodi release payload.");
    return;
  }
  if (command === "create-tag" && args.length === 1) {
    await createTag(publication, process.env.ROOT_GITHUB_TOKEN, args[0]);
    console.log(`Verified coordinated annotated tag ${publication.tagName}.`);
    return;
  }
  if (command === "create-draft" && args.length === 2) {
    if (args[1] !== PACKAGE_DIRECTORY) fail(`package directory must be ${PACKAGE_DIRECTORY}`);
    const release = await createDraft(
      publication,
      candidate,
      process.env.ROOT_GITHUB_TOKEN,
      args[0],
      resolve(root, PACKAGE_DIRECTORY),
      resolve(root, publication.releaseNotesPath),
    );
    console.log(`Verified non-public coordinated draft release ${release.id}.`);
    return;
  }
  fail("usage: package-release.mjs (check-inputs <commit> | prepare <directory> | create-tag <commit> | create-draft <commit> <directory>)");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
