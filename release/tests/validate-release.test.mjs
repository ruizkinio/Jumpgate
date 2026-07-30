import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  COMPONENT_POLICIES,
  GITLEAKS_POLICY,
  KODI_UPSTREAM_REPOSITORY,
  KODI_RELEASE_POLICY,
  PHYSICAL_EVIDENCE_MAX_AGE_MS,
  REQUIRED_UAT_CASES,
  STREMIO_RELEASE_POLICY,
  commitContainsAncestor,
  coreContainsRequiredFix,
  extractZipEntry,
  parseAapt2Badging,
  parseApkSignerCertificate,
  parseEvidenceBlobUrl,
  parseGithubActionsRunUrl,
  parseLockedCoreDependency,
  parseZipEntries,
  publicRefManifestSha256,
  pullRequestHeadTreeMatchesCandidate,
  readinessBlockers,
  securityFindingFingerprint,
  validateCandidate,
  validateBridgeDeploymentAttestation,
  validateEvidence,
  validateGitlinks,
  validateKodiApkManifest,
  validateNpmProvenance,
  validateSecurityAudit,
  validateSecurityAllowlist,
  validateSecurityReport,
  validateUatReport,
  verifyComponentAuditedFiles,
  verifyGithubDeploymentAttestation,
  verifyCurrentPublicRefManifest,
  verifyLiveBridgeState,
} from "../validate-release.mjs";

const CANDIDATE_TEMPLATE = JSON.parse(
  readFileSync(new URL("../candidate.json", import.meta.url), "utf8"),
);
const TEST_NOW = new Date("2026-07-29T12:00:00Z");
const TEST_SIGNER_SHA256 = "f".repeat(64);
const TEST_RELEASE_SIGNER_POLICY = Object.freeze({
  state: "provisioned",
  certificateSha256: TEST_SIGNER_SHA256,
});

function candidate() {
  return structuredClone(CANDIDATE_TEMPLATE);
}

function physicalEvidence() {
  const locked = candidate();
  const run = (deviceClass, manufacturer, model, abi, marker) => ({
    deviceClass,
    manufacturer,
    model,
    androidApi: 35,
    abi,
    testedAt: "2026-07-28T18:00:00Z",
    apkSha256: locked.components.kodi.artifacts[abi].apkSha256,
    signerSha256: TEST_SIGNER_SHA256,
    stremioPackageName: "com.stremio.one",
    stremioVersionName: "2.1.5",
    stremioVersionCode: 2115001,
    evidenceSha256: marker.repeat(64),
    evidenceUrl:
      `https://github.com/ruizkinio/Jumpgate/blob/${marker.repeat(40)}/release/evidence/${deviceClass}.json`,
    caseCount: REQUIRED_UAT_CASES.length,
  });
  return {
    schemaVersion: 1,
    candidate: {
      coordinatedVersion: locked.coordinatedVersion,
      bridgeCommit: locked.components.bridge.commit,
      bridgeImageDigest: locked.components.bridge.imageDigest,
      kodiCommit: locked.components.kodi.commit,
      stremioReleaseCommit: locked.stremio.releaseCommit,
      stremioCoreGitHead: locked.stremio.coreGitHead,
    },
    runs: [
      run("phone", "Google", "Pixel 9", "arm64-v8a", "a"),
      run("tv", "Rockchip", "cm01 se", "armeabi-v7a", "b"),
    ],
  };
}

function uatReport(run, locked = candidate()) {
  return {
    schemaVersion: 1,
    candidate: {
      coordinatedVersion: locked.coordinatedVersion,
      bridgeCommit: locked.components.bridge.commit,
      bridgeImageDigest: locked.components.bridge.imageDigest,
      kodiCommit: locked.components.kodi.commit,
      stremioReleaseCommit: locked.stremio.releaseCommit,
      stremioCoreGitHead: locked.stremio.coreGitHead,
    },
    device: {
      deviceClass: run.deviceClass,
      manufacturer: run.manufacturer,
      model: run.model,
      androidApi: run.androidApi,
      abi: run.abi,
      apkSha256: run.apkSha256,
      signerSha256: run.signerSha256,
      stremioPackageName: run.stremioPackageName,
      stremioVersionName: run.stremioVersionName,
      stremioVersionCode: run.stremioVersionCode,
    },
    testedAt: run.testedAt,
    bridge: {
      version: locked.coordinatedVersion,
      buildSha: locked.components.bridge.commit,
      imageDigest: locked.components.bridge.imageDigest,
    },
    cases: REQUIRED_UAT_CASES.map((id) => ({
      id,
      status: "pass",
      observation: `Observed the expected bounded result for ${id}.`,
    })),
  };
}

function securityAllowlist(entries = []) {
  return { schemaVersion: 1, entries };
}

function securityFinding(marker = "a") {
  const record = {
    rule: "generic-api-key",
    commit: marker.repeat(40),
    path: "fixtures/credential-shaped.txt",
    startLine: 7,
    endLine: 7,
    startColumn: 3,
    endColumn: 24,
  };
  return { fingerprint: securityFindingFingerprint(record), ...record };
}

function securityAudit() {
  const records = Object.entries({
    "ruizkinio/Jumpgate": "all-public-history",
    "ruizkinio/Jumpgate-bridge": "all-public-branches-and-tags",
    "ruizkinio/Jumpgate-kodi": "jumpgate-authored-public-ranges-and-branches",
  }).map(([repository, scope], index) => {
    const refs = [{ name: "refs/heads/main", objectId: String(index + 1).repeat(40) }];
    const upstreamRefs = [{ name: "refs/heads/master", objectId: "9".repeat(40) }];
    const upstream = repository === "ruizkinio/Jumpgate-kodi"
      ? {
          repository: KODI_UPSTREAM_REPOSITORY,
          refs: upstreamRefs,
          auditedRefsSha256: publicRefManifestSha256(upstreamRefs),
        }
      : null;
    return {
      repository,
      scope,
      refs,
      auditedRefsSha256: publicRefManifestSha256(refs),
      upstream,
      reviewedRanges: [{
        ref: refs[0].name,
        tip: refs[0].objectId,
        selection: upstream ? "tip-minus-upstream-public-history" : "reachable-history",
        excludedRefsSha256: upstream?.auditedRefsSha256 ?? null,
      }],
      rawFindings: [],
      allowlistedFindingFingerprints: [],
      unresolvedFindingFingerprints: [],
      commands: repository === "ruizkinio/Jumpgate-kodi"
        ? [
            "git ls-remote --heads --tags",
            "git fetch --filter=blob:none --no-tags --stdin into refs/jumpgate-audit/public",
            "git fetch --filter=blob:none --no-tags --stdin into refs/jumpgate-audit/upstream",
            "gitleaks git --redact=100 --log-opts=--full-history --diff-filter=tuxdb --all --not --glob=refs/jumpgate-audit/upstream/*",
          ]
        : [
            "git ls-remote --heads --tags",
            "git fetch --filter=blob:none --no-tags --stdin into refs/jumpgate-audit/public",
            "gitleaks git --redact=100 --log-opts=--full-history --diff-filter=tuxdb --all",
          ],
    };
  });
  return {
    schemaVersion: 4,
    candidate: {
      bridgeCommit: CANDIDATE_TEMPLATE.components.bridge.commit,
      kodiCommit: CANDIDATE_TEMPLATE.components.kodi.commit,
    },
    completedAt: "2026-07-29T10:00:00Z",
    scanner: {
      name: GITLEAKS_POLICY.scanner,
      version: GITLEAKS_POLICY.version,
      archiveSha256: GITLEAKS_POLICY.linuxX64ArchiveSha256,
      configSha256: GITLEAKS_POLICY.configSha256,
    },
    allowlistSha256: "a".repeat(64),
    repositories: records,
  };
}

function storedZip(name, body) {
  const nameBytes = Buffer.from(name);
  const bytes = Buffer.from(body);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(bytes.length, 18);
  local.writeUInt32LE(bytes.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(bytes.length, 20);
  central.writeUInt32LE(bytes.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  const centralOffset = local.length + nameBytes.length + bytes.length;
  const centralSize = central.length + nameBytes.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, nameBytes, bytes, central, nameBytes, end]);
}

function npmSlsaStatement(stremio, tarballSha512) {
  const ref = `refs/tags/stremio-core-web-v${stremio.coreVersion}`;
  return {
    _type: "https://in-toto.io/Statement/v1",
    subject: [
      {
        name: `pkg:npm/%40stremio/stremio-core-web@${stremio.coreVersion}`,
        digest: { sha512: tarballSha512 },
      },
    ],
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        buildType: "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
        externalParameters: {
          workflow: {
            ref,
            repository: "https://github.com/Stremio/stremio-core",
            path: ".github/workflows/publish.yml",
          },
        },
        internalParameters: {
          github: {
            event_name: "release",
            repository_id: "163698806",
            repository_owner_id: "13152917",
          },
        },
        resolvedDependencies: [
          {
            uri: `git+https://github.com/Stremio/stremio-core@${ref}`,
            digest: { gitCommit: stremio.coreGitHead },
          },
        ],
      },
      runDetails: {
        builder: { id: "https://github.com/actions/runner/github-hosted" },
        metadata: {
          invocationId:
            "https://github.com/Stremio/stremio-core/actions/runs/27526289973/attempts/1",
        },
      },
    },
  };
}

function npmAttestations(statement) {
  return {
    attestations: [
      {
        predicateType: "https://github.com/npm/attestation/tree/main/specs/publish/v0.1",
        bundle: {},
      },
      {
        predicateType: "https://slsa.dev/provenance/v1",
        bundle: {
          mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json",
          verificationMaterial: {
            certificate: { rawBytes: "Y2VydGlmaWNhdGU=" },
            tlogEntries: [
              {
                inclusionPromise: { signedEntryTimestamp: "cHJvbWlzZQ==" },
                inclusionProof: { rootHash: "cHJvb2Y=" },
              },
            ],
          },
          dsseEnvelope: {
            payload: Buffer.from(JSON.stringify(statement)).toString("base64"),
            payloadType: "application/vnd.in-toto+json",
            signatures: [{ sig: "c2lnbmF0dXJl" }],
          },
        },
      },
    ],
  };
}

test("candidate metadata is schema-checked rather than hardcoded to one commit", () => {
  const value = candidate();
  value.components.bridge.commit = "1".repeat(40);
  value.components.kodi.commit = "2".repeat(40);
  assert.equal(validateCandidate(value), value);
  value.ready = true;
  assert.throws(() => validateCandidate(value), /must contain exactly/);
});

test("candidate repositories, protected-run identity, and artifact metadata fail closed", () => {
  const wrongRepo = candidate();
  wrongRepo.components.kodi.repository = "https://github.com/example/Jumpgate-kodi.git";
  assert.throws(() => validateCandidate(wrongRepo), /must use/);

  const wrongWorkflow = candidate();
  wrongWorkflow.components.bridge.provenance.workflowPath = ".github/workflows/weaker.yml";
  assert.throws(() => validateCandidate(wrongWorkflow), /protected push workflow/);

  const query = candidate();
  query.components.bridge.provenance.runUrl += "?token=secret";
  assert.throws(() => validateCandidate(query), /without query or fragment/);

  const badArtifact = candidate();
  badArtifact.components.kodi.artifacts["arm64-v8a"].archiveDigest = "sha256:1234";
  assert.throws(() => validateCandidate(badArtifact), /lowercase sha256 digest/);
});

test("candidate metadata cannot override release security policy", () => {
  assert.equal(
    STREMIO_RELEASE_POLICY.requiredCoreFix,
    "46091b81ec6865fc1bb6e1d056409b78482cfc61",
  );
  assert.equal(KODI_RELEASE_POLICY.apkManifest.applicationId, "io.github.ruizkinio.jumpgate");
  assert.deepEqual(KODI_RELEASE_POLICY.signer, {
    state: "not-yet-provisioned",
    certificateSha256: null,
  });

  const selectedCoreFix = candidate();
  selectedCoreFix.stremio.requiredCoreFix = "0".repeat(40);
  assert.throws(() => validateCandidate(selectedCoreFix), /must contain exactly/);

  const selectedApplicationId = candidate();
  selectedApplicationId.components.kodi.packageName = "org.example.forged";
  assert.throws(() => validateCandidate(selectedApplicationId), /must contain exactly/);

  const selectedSigner = candidate();
  selectedSigner.components.kodi.artifacts["arm64-v8a"].signingClass = "release";
  selectedSigner.components.kodi.artifacts["arm64-v8a"].signerSha256 = "a".repeat(64);
  assert.throws(() => validateCandidate(selectedSigner), /must contain exactly/);
});

test("GitHub run URLs are exact and repository-bound", () => {
  assert.equal(
    parseGithubActionsRunUrl(
      "https://github.com/ruizkinio/Jumpgate-kodi/actions/runs/30253147375",
      "ruizkinio/Jumpgate-kodi",
    ),
    "30253147375",
  );
  assert.throws(
    () =>
      parseGithubActionsRunUrl(
        "https://github.com/ruizkinio/Jumpgate-bridge/actions/runs/30253147375",
        "ruizkinio/Jumpgate-kodi",
      ),
    /exact/,
  );
});

test("gitlinks fail closed on a component mismatch", () => {
  const value = candidate();
  const links = new Map([
    ["stremio-addon", { mode: "160000", commit: value.components.bridge.commit }],
    ["xbmc", { mode: "160000", commit: "0".repeat(40) }],
  ]);
  assert.throws(() => validateGitlinks(value, links), /xbmc gitlink/);
});

test("Web package and lock must agree on the exact core dependency", () => {
  const value = candidate();
  const packageJson = {
    version: value.stremio.releaseTag.slice(1),
    dependencies: { [value.stremio.corePackage]: value.stremio.coreVersion },
  };
  const lock = [
    "importers:",
    "",
    "  .:",
    "    dependencies:",
    `      '${value.stremio.corePackage}':`,
    `        specifier: ${value.stremio.coreVersion}`,
    "        version: 99.0.0",
  ].join("\n");
  assert.throws(() => parseLockedCoreDependency(packageJson, lock, value.stremio), /does not pin/);
});

test("only ancestor or identical commits satisfy public reachability", () => {
  const ancestor = "1".repeat(40);
  const descendant = "2".repeat(40);
  const ahead = {
    status: "ahead",
    base_commit: { sha: ancestor },
    merge_base_commit: { sha: ancestor },
  };
  assert.equal(commitContainsAncestor(ahead, ancestor, descendant), true);
  assert.equal(commitContainsAncestor(null, ancestor, ancestor), true);
  const diverged = structuredClone(ahead);
  diverged.status = "diverged";
  diverged.merge_base_commit.sha = "0".repeat(40);
  assert.equal(commitContainsAncestor(diverged, ancestor, descendant), false);
  assert.equal(coreContainsRequiredFix(diverged, ancestor, descendant), false);
});

test("release-critical Kodi PR requires exact candidate and PR head tree equality", () => {
  const component = { commit: "1".repeat(40) };
  const tree = "2".repeat(40);
  const head = "3".repeat(40);
  const pull = {
    number: 5,
    merged_at: "2026-07-29T10:00:00Z",
    merge_commit_sha: "5".repeat(40),
    base: { ref: "master", repo: { full_name: "ruizkinio/Jumpgate-kodi" } },
    head: { sha: head, repo: { full_name: "ruizkinio/Jumpgate-kodi" } },
  };
  const candidateGitCommit = { sha: component.commit, tree: { sha: tree } };
  const pullHeadGitCommit = { sha: head, tree: { sha: tree } };
  const mergeAncestor = {
    status: "ahead",
    base_commit: { sha: pull.merge_commit_sha },
    merge_base_commit: { sha: pull.merge_commit_sha },
  };
  assert.equal(
    pullRequestHeadTreeMatchesCandidate(
      pull,
      component,
      candidateGitCommit,
      pullHeadGitCommit,
      COMPONENT_POLICIES.kodi,
      mergeAncestor,
    ),
    true,
  );

  const revertedCandidate = structuredClone(candidateGitCommit);
  revertedCandidate.tree.sha = "4".repeat(40);
  assert.equal(
    pullRequestHeadTreeMatchesCandidate(
      pull,
      component,
      revertedCandidate,
      pullHeadGitCommit,
      COMPONENT_POLICIES.kodi,
      mergeAncestor,
    ),
    false,
  );

  const missingMergeCommit = structuredClone(pull);
  delete missingMergeCommit.merge_commit_sha;
  assert.equal(
    pullRequestHeadTreeMatchesCandidate(
      missingMergeCommit,
      component,
      candidateGitCommit,
      pullHeadGitCommit,
      COMPONENT_POLICIES.kodi,
      null,
    ),
    false,
  );

  const divergedMerge = {
    status: "diverged",
    base_commit: { sha: pull.merge_commit_sha },
    merge_base_commit: { sha: "0".repeat(40) },
  };
  assert.equal(
    pullRequestHeadTreeMatchesCandidate(
      pull,
      component,
      candidateGitCommit,
      pullHeadGitCommit,
      COMPONENT_POLICIES.kodi,
      divergedMerge,
    ),
    false,
  );
});

test("audited component executable closures are exact and reject byte or policy drift", async () => {
  const audited = new Map([
    [".github/workflows/release.yml", Buffer.from("name: protected\n")],
    ["scripts/deploy.js", Buffer.from("console.log('deploy');\n")],
    [".npmrc", Buffer.from("ignore-scripts=true\n")],
  ]);
  const policy = {
    slug: "ruizkinio/example",
    auditedFiles: [...audited].map(([path, bytes]) => ({
      path,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    })),
  };
  const component = { commit: "1".repeat(40) };
  const requestedUrls = [];
  const verified = await verifyComponentAuditedFiles(component, policy, "Example", async (url) => {
    requestedUrls.push(url);
    return audited.get(new URL(url).pathname.split(`/${component.commit}/`)[1]);
  });
  assert.deepEqual(
    Object.keys(verified),
    [...audited.keys()],
  );
  assert.deepEqual(
    requestedUrls,
    [...audited.keys()].map(
      (path) => `https://raw.githubusercontent.com/${policy.slug}/${component.commit}/${path}`,
    ),
  );

  for (const changedPath of audited.keys()) {
    await assert.rejects(
      verifyComponentAuditedFiles(component, policy, "Example", async (url) => {
        const path = new URL(url).pathname.split(`/${component.commit}/`)[1];
        return path === changedPath ? Buffer.from("changed\n") : audited.get(path);
      }),
      /do not match policy/,
      changedPath,
    );
  }

  await assert.rejects(
    verifyComponentAuditedFiles(
      component,
      { ...policy, auditedFiles: [...policy.auditedFiles, policy.auditedFiles[0]] },
      "Example",
      async (url) => audited.get(new URL(url).pathname.split(`/${component.commit}/`)[1]),
    ),
    /duplicated/,
  );
  await assert.rejects(
    verifyComponentAuditedFiles(
      component,
      { ...policy, auditedFiles: [{ ...policy.auditedFiles[0], path: "../substitute" }] },
      "Example",
      async () => audited.values().next().value,
    ),
    /unsafe/,
  );

  assert.deepEqual(
    COMPONENT_POLICIES.bridge.auditedFiles.map(({ path, sha256 }) => ({ path, sha256 })),
    [
      [".github/workflows/fly-deploy.yml", "1c2cc3f72ea000b489218e612319a87131c4d4f4b5e4faf2eeecf857dc2305ab"],
      ["scripts/ci/fly-managed-rollout.js", "2e0af3926869a36c3d81f44bb59cb5cfda49a0d8bb03c8e96b8c780a2ff2bad0"],
      ["scripts/ci/deployment-attestation.js", "8bdd29ef1c9ae853bf90ed438f39d1083ea05526779e553971833ee00c87ffc0"],
      ["scripts/ci/http-smoke.js", "c1a658a8e17d4eed4041c71ac8834fe9ef254a59c9f075a81b10cdd83a223ff0"],
      ["package.json", "49fa6223dfd7424757af071f63b2862dacf39513d85117ddb4e482fc01898841"],
      ["package-lock.json", "f99690d0f821d8f399aa2c37ddc15722751712e109a3b44c3ba8a92cd3135a91"],
      [".npmrc", "89570b4333de5a4920e113d299e774c671b4e83ebfe34757ad27c3960a7bd269"],
      ["fly.toml", "b594218d0650290789fbe97f64bd29da217c73c1c06a9e12002df9cbd12cfb23"],
    ].map(([path, sha256]) => ({ path, sha256 })),
  );
});

test("build-tools output locks actual Kodi package and versions", () => {
  const output = [
    "package: name='io.github.ruizkinio.jumpgate' versionCode='2200300' versionName='22.0-ALPHA2-Jumpgate-3.0.0' compileSdkVersion='35'",
    "sdkVersion:'24'",
  ].join("\n");
  const manifest = parseAapt2Badging(output);
  assert.deepEqual(manifest, KODI_RELEASE_POLICY.apkManifest);
  assert.equal(validateKodiApkManifest(manifest), manifest);

  for (const [field, value] of [
    ["applicationId", "org.example.forged"],
    ["versionCode", 2200301],
    ["versionName", "22.0-ALPHA2-Jumpgate-9.9.9"],
  ]) {
    const changed = { ...manifest, [field]: value };
    assert.throws(() => validateKodiApkManifest(changed), /must be/);
  }

  assert.equal(
    parseApkSignerCertificate(
      `Signer #1 certificate SHA-256 digest: ${TEST_SIGNER_SHA256.toUpperCase()}`,
    ),
    TEST_SIGNER_SHA256,
  );
  assert.throws(
    () =>
      parseApkSignerCertificate(
        `Signer #1 certificate SHA-256 digest: ${TEST_SIGNER_SHA256}\n` +
          `Signer #2 certificate SHA-256 digest: ${"a".repeat(64)}`,
      ),
    /exactly one/,
  );
});

test("physical evidence requires fresh distinct devices and locked ABI artifacts", () => {
  const valid = physicalEvidence();
  assert.equal(
    validateEvidence(valid, candidate(), TEST_NOW, TEST_RELEASE_SIGNER_POLICY),
    valid,
  );

  const stale = physicalEvidence();
  stale.runs[0].testedAt = new Date(
    TEST_NOW.valueOf() - PHYSICAL_EVIDENCE_MAX_AGE_MS - 1,
  ).toISOString();
  assert.throws(
    () => validateEvidence(stale, candidate(), TEST_NOW, TEST_RELEASE_SIGNER_POLICY),
    /older than the 30-day/,
  );

  const wrongApk = physicalEvidence();
  wrongApk.runs[1].apkSha256 = "0".repeat(64);
  assert.throws(
    () => validateEvidence(wrongApk, candidate(), TEST_NOW, TEST_RELEASE_SIGNER_POLICY),
    /locked armeabi-v7a APK/,
  );

  const shared = physicalEvidence();
  shared.runs[1].evidenceUrl = shared.runs[0].evidenceUrl;
  shared.runs[1].evidenceSha256 = shared.runs[0].evidenceSha256;
  assert.throws(
    () => validateEvidence(shared, candidate(), TEST_NOW, TEST_RELEASE_SIGNER_POLICY),
    /distinct immutable/,
  );

  const wrongSigner = physicalEvidence();
  wrongSigner.runs[0].signerSha256 = "a".repeat(64);
  assert.throws(
    () => validateEvidence(wrongSigner, candidate(), TEST_NOW, TEST_RELEASE_SIGNER_POLICY),
    /policy-locked Kodi release signer/,
  );
});

test("the public UAT protocol documents every stable evidence case exactly once", () => {
  const protocol = readFileSync(new URL("../../docs/UAT.md", import.meta.url), "utf8");
  const documented = [...protocol.matchAll(/\[`([a-z0-9-]+\/[a-z0-9-]+)`\]/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(documented, REQUIRED_UAT_CASES);
  assert.equal(new Set(documented).size, documented.length);
});

test("UAT reports require an observed pass for every protocol case", () => {
  const evidence = physicalEvidence();
  const report = uatReport(evidence.runs[0]);
  assert.equal(validateUatReport(report, evidence.runs[0], candidate()), report);

  const failed = structuredClone(report);
  failed.cases[0].status = "fail";
  assert.throws(() => validateUatReport(failed, evidence.runs[0], candidate()), /must be pass/);

  const unrelated = structuredClone(report);
  unrelated.cases.pop();
  assert.throws(() => validateUatReport(unrelated, evidence.runs[0], candidate()), /every required case/);

  const control = structuredClone(report);
  control.cases[0].observation = "forged\nline";
  assert.throws(() => validateUatReport(control, evidence.runs[0], candidate()), /sanitized/);
});

test("evidence URLs must be immutable public blobs without ambient data", () => {
  const parsed = parseEvidenceBlobUrl(
    `https://github.com/ruizkinio/Jumpgate/blob/${"a".repeat(40)}/release/evidence/tv.json`,
  );
  assert.equal(parsed.repository, "Jumpgate");
  assert.throws(
    () => parseEvidenceBlobUrl("https://github.com/ruizkinio/Jumpgate/issues/10"),
    /immutable public/,
  );
  assert.throws(
    () =>
      parseEvidenceBlobUrl(
        `https://github.com/ruizkinio/Jumpgate/blob/${"a".repeat(40)}/evidence.json?token=x`,
      ),
    /without query or fragment/,
  );
});

test("security audit evidence is scoped, zero-finding, and reproducible", () => {
  const emptyAllowlist = securityAllowlist();
  const audit = securityAudit();
  assert.equal(
    validateSecurityAudit(audit, candidate(), TEST_NOW, emptyAllowlist, audit.allowlistSha256),
    audit,
  );
  assert.equal(validateSecurityReport(audit.repositories[0], audit.scanner), audit.repositories[0]);

  const reviewedFinding = securityFinding();
  const reviewed = securityAllowlist([{
    repository: "ruizkinio/Jumpgate",
    fingerprint: reviewedFinding.fingerprint,
    reason: "Reviewed credential-shaped test fixture with no authority.",
    expiresAt: "2026-08-29T10:00:00Z",
  }]);
  const allowlistedAudit = securityAudit();
  allowlistedAudit.repositories[0].rawFindings = [reviewedFinding];
  allowlistedAudit.repositories[0].allowlistedFindingFingerprints = [
    reviewedFinding.fingerprint,
  ];
  assert.equal(
    validateSecurityAudit(
      allowlistedAudit,
      candidate(),
      TEST_NOW,
      reviewed,
      allowlistedAudit.allowlistSha256,
    ),
    allowlistedAudit,
  );
  const contaminatedRecord = structuredClone(allowlistedAudit);
  contaminatedRecord.repositories[0].rawFindings[0].secret = "must-not-be-present";
  assert.throws(
    () => validateSecurityAudit(
      contaminatedRecord,
      candidate(),
      TEST_NOW,
      reviewed,
      contaminatedRecord.allowlistSha256,
    ),
    /must contain exactly/,
  );
  const forgedRecord = structuredClone(allowlistedAudit);
  forgedRecord.repositories[0].rawFindings[0].path = "fixtures/moved.txt";
  assert.throws(
    () => validateSecurityAudit(
      forgedRecord,
      candidate(),
      TEST_NOW,
      reviewed,
      forgedRecord.allowlistSha256,
    ),
    /must derive from the sanitized location record/,
  );

  const finding = securityAudit();
  const unresolvedFinding = securityFinding("b");
  finding.repositories[1].rawFindings = [unresolvedFinding];
  finding.repositories[1].unresolvedFindingFingerprints = [unresolvedFinding.fingerprint];
  assert.equal(
    validateSecurityAudit(finding, candidate(), TEST_NOW, emptyAllowlist, finding.allowlistSha256, false),
    finding,
  );
  assert.throws(
    () => validateSecurityAudit(finding, candidate(), TEST_NOW),
    /unresolved findings must be zero/,
  );

  const substitutedScanner = securityAudit();
  substitutedScanner.scanner.version = "8.30.2";
  assert.throws(
    () => validateSecurityAudit(substitutedScanner, candidate(), TEST_NOW),
    /policy-pinned Gitleaks/,
  );

  const staleAllowlistAudit = securityAudit();
  assert.throws(
    () => validateSecurityAudit(
      staleAllowlistAudit,
      candidate(),
      TEST_NOW,
      reviewed,
      staleAllowlistAudit.allowlistSha256,
    ),
    /use every exact repository allowlist entry/,
  );

  const expired = structuredClone(reviewed);
  expired.entries[0].expiresAt = "2026-07-29T09:59:59Z";
  assert.throws(
    () => validateSecurityAllowlist(expired, new Date(audit.completedAt)),
    /expired/,
  );

  const missingRange = securityAudit();
  missingRange.repositories[2].reviewedRanges = [];
  assert.throws(
    () => validateSecurityAudit(missingRange, candidate(), TEST_NOW),
    /cover every public head and tag/,
  );

  const movedExclusion = securityAudit();
  movedExclusion.repositories[2].reviewedRanges[0].excludedRefsSha256 = "f".repeat(64);
  assert.throws(
    () => validateSecurityAudit(movedExclusion, candidate(), TEST_NOW),
    /bind the exact exclusion set/,
  );

  const refs = audit.repositories[0].refs;
  const movedRef = structuredClone(refs);
  movedRef[0].objectId = "2".repeat(40);
  assert.throws(
    () => verifyCurrentPublicRefManifest(refs, movedRef),
    /do not match the current remote/,
  );
  assert.throws(
    () =>
      verifyCurrentPublicRefManifest(refs, [
        ...refs,
        { name: "refs/tags/v3.0.0", objectId: "3".repeat(40) },
      ]),
    /do not match the current remote/,
  );
  assert.throws(
    () => verifyCurrentPublicRefManifest(refs, []),
    /bounded non-empty array/,
  );

  const staleHash = structuredClone(audit.repositories[0]);
  staleHash.refs[0].objectId = "4".repeat(40);
  assert.throws(
    () => validateSecurityReport(staleHash, audit.scanner),
    /must derive from its exact public ref manifest/,
  );
});

test("npm SLSA provenance verifies cryptographically before exact statement validation", async () => {
  const stremio = candidate().stremio;
  const tarballSha512 = "a".repeat(128);
  const statement = npmSlsaStatement(stremio, tarballSha512);
  const attestations = npmAttestations(statement);
  let verifiedBundle;
  let verifiedPolicy;
  const verifier = async (bundle, policy) => {
    verifiedBundle = bundle;
    verifiedPolicy = policy;
  };

  assert.deepEqual(
    await validateNpmProvenance(attestations, stremio, tarballSha512, verifier),
    statement,
  );
  assert.equal(verifiedBundle, attestations.attestations[1].bundle);
  assert.equal(verifiedPolicy.certificateIssuer, "https://token.actions.githubusercontent.com");
  assert.equal(
    verifiedPolicy.certificateIdentityURI,
    "^https://github\\.com/Stremio/stremio-core/\\.github/workflows/publish\\.yml@refs/tags/stremio-core-web-v0\\.59\\.0$",
  );
  assert.deepEqual(verifiedPolicy.certificateOIDs, {
    "1.3.6.1.4.1.57264.1.2": "release",
    "1.3.6.1.4.1.57264.1.3": stremio.coreGitHead,
    "1.3.6.1.4.1.57264.1.4": "Publish",
    "1.3.6.1.4.1.57264.1.5": "Stremio/stremio-core",
    "1.3.6.1.4.1.57264.1.6": "refs/tags/stremio-core-web-v0.59.0",
  });
  assert.equal(verifiedPolicy.tlogThreshold, 1);
  assert.equal(verifiedPolicy.ctLogThreshold, 1);
  assert.equal(verifiedPolicy.timeout, 5_000);
  assert.match(verifiedPolicy.tufCachePath, /jumpgate-sigstore-tuf-v1$/);
});

test("npm SLSA payload parsing is not reached when signature verification rejects", async () => {
  const stremio = candidate().stremio;
  const tarballSha512 = "a".repeat(128);
  const attestations = npmAttestations(npmSlsaStatement(stremio, tarballSha512));
  const envelope = attestations.attestations[1].bundle.dsseEnvelope;
  Object.defineProperty(envelope, "payload", {
    enumerable: true,
    get() {
      throw new Error("payload parsed before verification");
    },
  });
  let verifierCalled = false;
  await assert.rejects(
    validateNpmProvenance(attestations, stremio, tarballSha512, async () => {
      verifierCalled = true;
      throw new Error("signature verification rejected");
    }),
    /signature verification rejected/,
  );
  assert.equal(verifierCalled, true);
});

test("npm SLSA provenance requires the complete Sigstore v0.3 bundle shape", async () => {
  const stremio = candidate().stremio;
  const tarballSha512 = "a".repeat(128);
  const verifier = async () => {};
  const mutations = [
    (bundle) => {
      bundle.mediaType = "application/vnd.dev.sigstore.bundle.v0.2+json";
    },
    (bundle) => {
      bundle.dsseEnvelope.signatures.push({ sig: "c2Vjb25k" });
    },
    (bundle) => {
      delete bundle.verificationMaterial.certificate;
    },
    (bundle) => {
      bundle.verificationMaterial.tlogEntries.push(
        structuredClone(bundle.verificationMaterial.tlogEntries[0]),
      );
    },
    (bundle) => {
      delete bundle.verificationMaterial.tlogEntries[0].inclusionPromise;
    },
    (bundle) => {
      delete bundle.verificationMaterial.tlogEntries[0].inclusionProof;
    },
  ];
  for (const mutate of mutations) {
    const attestations = npmAttestations(npmSlsaStatement(stremio, tarballSha512));
    mutate(attestations.attestations[1].bundle);
    await assert.rejects(
      validateNpmProvenance(attestations, stremio, tarballSha512, verifier),
    );
  }
});

test("npm SLSA provenance rejects duplicate attestations and statement identity drift", async () => {
  const stremio = candidate().stremio;
  const tarballSha512 = "a".repeat(128);
  const verifier = async () => {};
  const duplicate = npmAttestations(npmSlsaStatement(stremio, tarballSha512));
  duplicate.attestations.push(structuredClone(duplicate.attestations[1]));
  await assert.rejects(
    validateNpmProvenance(duplicate, stremio, tarballSha512, verifier),
    /exactly one SLSA v1 attestation/,
  );

  const mutations = [
    (value) => {
      value.extra = true;
    },
    (value) => {
      value.predicate.buildDefinition.buildType = "https://example.invalid/build";
    },
    (value) => {
      value.predicate.buildDefinition.externalParameters.workflow.ref = "refs/heads/main";
    },
    (value) => {
      value.predicate.buildDefinition.internalParameters.github.event_name = "push";
    },
    (value) => {
      value.predicate.buildDefinition.resolvedDependencies[0].digest.gitCommit = "0".repeat(40);
    },
    (value) => {
      value.predicate.runDetails.builder.id = "https://example.invalid/runner";
    },
    (value) => {
      value.predicate.runDetails.metadata.invocationId =
        "https://github.com/Other/repository/actions/runs/1/attempts/1";
    },
  ];
  for (const mutate of mutations) {
    const drifted = npmSlsaStatement(stremio, tarballSha512);
    mutate(drifted);
    await assert.rejects(
      validateNpmProvenance(npmAttestations(drifted), stremio, tarballSha512, verifier),
    );
  }
});

test("ZIP verification rejects traversal and extracts only bounded declared entries", () => {
  const archive = storedZip("artifact.apk", "verified bytes");
  const entries = parseZipEntries(archive);
  assert.equal(extractZipEntry(archive, entries, "artifact.apk", 100).toString(), "verified bytes");
  assert.throws(() => parseZipEntries(storedZip("../escape.apk", "x")), /unsafe/);
  assert.throws(() => extractZipEntry(archive, entries, "artifact.apk", 2), /oversized/);
});

test("Bridge deployment proof binds the exact fleet, config, workflow run, and candidate", () => {
  const locked = candidate();
  const runId = new URL(locked.components.bridge.provenance.runUrl).pathname.split("/").at(-1);
  const flyConfigSha256 = "e".repeat(64);
  const attestation = {
    schemaVersion: 2,
    bridgeCommit: locked.components.bridge.commit,
    imageDigest: locked.components.bridge.imageDigest,
    workflowRunId: runId,
    workflowId: locked.components.bridge.provenance.workflowId,
    application: "jumpgate-bridge",
    releaseId: "rel_1234567890abcdef",
    machineIds: ["0123456789abcd", "1123456789abcd"],
    managedIntervals: 3,
    writerProtocol: "v6",
    flyConfigSha256,
    verifiedAt: "2026-07-29T12:34:56.789Z",
    status: "deployed-and-smoke-tested",
  };
  assert.equal(
    validateBridgeDeploymentAttestation(attestation, locked, flyConfigSha256),
    attestation,
  );
  const mutations = [
    (value) => { value.schemaVersion = 1; },
    (value) => { value.bridgeCommit = "0".repeat(40); },
    (value) => { value.imageDigest = `sha256:${"0".repeat(64)}`; },
    (value) => { value.workflowRunId = "1"; },
    (value) => { value.machineIds.pop(); },
    (value) => { value.machineIds.reverse(); },
    (value) => { value.managedIntervals = 2; },
    (value) => { value.writerProtocol = "transition"; },
    (value) => { value.flyConfigSha256 = "0".repeat(64); },
    (value) => { value.status = "deployed"; },
    (value) => { value.untrusted = true; },
  ];
  for (const mutate of mutations) {
    const drifted = structuredClone(attestation);
    mutate(drifted);
    assert.throws(
      () => validateBridgeDeploymentAttestation(drifted, locked, flyConfigSha256),
    );
  }
});

test("GitHub OIDC verification uses exact signer and source policy before accepting bytes", () => {
  const locked = candidate();
  const bytes = Buffer.from('{"canonical":true}\n');
  const digest = createHash("sha256").update(bytes).digest("hex");
  const previous = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = "test-app-token";
  let invocation;
  try {
    assert.equal(
      verifyGithubDeploymentAttestation(
        "C:/evidence/deployment-attestation.json",
        bytes,
        locked,
        (file, args, options) => {
          invocation = { file, args, options };
          return JSON.stringify([{
            verificationResult: {
              statement: { subject: [{ digest: { sha256: digest } }] },
            },
          }]);
        },
      ),
      true,
    );
  } finally {
    if (previous === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previous;
  }
  assert.equal(invocation.file, "gh");
  assert.deepEqual(invocation.args, [
    "attestation",
    "verify",
    "C:/evidence/deployment-attestation.json",
    "--repo",
    "ruizkinio/Jumpgate-bridge",
    "--signer-workflow",
    "ruizkinio/Jumpgate-bridge/.github/workflows/fly-deploy.yml",
    "--source-digest",
    locked.components.bridge.commit,
    "--source-ref",
    "refs/heads/main",
    "--deny-self-hosted-runners",
    "--limit",
    "1",
    "--format",
    "json",
  ]);
  assert.equal(invocation.options.env.GH_TOKEN, "test-app-token");
  assert.throws(
    () => {
      const old = process.env.GITHUB_TOKEN;
      process.env.GITHUB_TOKEN = "test-app-token";
      try {
        verifyGithubDeploymentAttestation("subject", bytes, locked, () => "[]");
      } finally {
        if (old === undefined) delete process.env.GITHUB_TOKEN;
        else process.env.GITHUB_TOKEN = old;
      }
    },
    /does not bind/,
  );
});

test("live Bridge proof rejects rollback and unhealthy deployment state", async () => {
  const locked = candidate();
  const version = {
    version: locked.coordinatedVersion,
    major: 3,
    minor: 0,
    patch: 0,
    buildSha: locked.components.bridge.commit,
  };
  const urls = [];
  assert.equal(
    await verifyLiveBridgeState(
      locked,
      async (url) => { urls.push(url); return version; },
      async (url) => { urls.push(url); return '{"ok":true,"status":"ready"}'; },
    ),
    true,
  );
  assert.deepEqual(urls.sort(), [
    "https://jumpgate-bridge.fly.dev/health/ready",
    "https://jumpgate-bridge.fly.dev/version",
  ]);
  await assert.rejects(
    verifyLiveBridgeState(
      locked,
      async () => ({ ...version, buildSha: "0".repeat(40) }),
      async () => '{"ok":true,"status":"ready"}',
    ),
    /live Bridge/,
  );
  await assert.rejects(
    verifyLiveBridgeState(
      locked,
      async () => version,
      async () => '{"ok":false,"status":"starting"}',
    ),
    /live Bridge/,
  );
});

test("readiness derives every publication proof independently", () => {
  const value = candidate();
  assert.deepEqual(
    readinessBlockers({
      candidate: value,
      coreContainsFix: false,
      physicalEvidence: null,
      securityAudit: null,
      liveSecurityProof: false,
      kodiArtifactProof: false,
      bridgeAttestationProof: false,
      missingPullRequests: ["Kodi#5"],
    }),
    [
      "required component pull requests are not merged into the candidate: Kodi#5",
      "the Kodi release signer is explicitly not yet provisioned; current APKs are ephemeral",
      "the deployed Bridge digest lacks a candidate-bound deployment attestation artifact",
      "the configured public Stremio release does not contain the required core fix",
      "sanitized physical phone and TV UAT evidence is absent",
      "bounded secret/history audit evidence is absent",
    ],
  );

  assert.deepEqual(
    readinessBlockers({
      candidate: value,
      coreContainsFix: true,
      physicalEvidence: physicalEvidence(),
      securityAudit: securityAudit(),
      liveSecurityProof: true,
      kodiArtifactProof: true,
      bridgeAttestationProof: true,
      missingPullRequests: [],
      releaseSignerPolicy: TEST_RELEASE_SIGNER_POLICY,
    }),
    [],
  );
});

test("release workflow is pinned, main-only, fixed-runner, and non-publishing", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/release-readiness.yml", import.meta.url),
    "utf8",
  );
  const uses = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)].map((match) => match[1]);
  assert.ok(uses.length >= 4);
  assert.ok(uses.every((value) => /@[0-9a-f]{40}$/.test(value)));
  assert.equal((workflow.match(/runs-on: ubuntu-24\.04/g) ?? []).length, 2);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(
    workflow,
    /uses: actions\/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1/,
  );
  const tokenStep = workflow.match(
    /      - name: Mint bounded cross-repository audit token\r?\n[\s\S]*?(?=\r?\n      - name:)/,
  )?.[0].replace(/\r\n/g, "\n");
  assert.equal(
    tokenStep,
    `      - name: Mint bounded cross-repository audit token
        id: audit-token
        uses: actions/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1 # v3.2.1
        with:
          client-id: \${{ secrets.JUMPGATE_AUDIT_APP_CLIENT_ID }}
          private-key: \${{ secrets.JUMPGATE_AUDIT_APP_PRIVATE_KEY }}
          owner: ruizkinio
          repositories: |
            Jumpgate
            Jumpgate-bridge
            Jumpgate-kodi
          permission-actions: read
          permission-attestations: read
          permission-contents: read
          permission-metadata: read
          permission-secret-scanning-alerts: read
          permission-security-events: read`,
  );
  assert.match(workflow, /GITHUB_TOKEN: \$\{\{ steps\.audit-token\.outputs\.token \}\}/);
  assert.doesNotMatch(
    workflow,
    /write-all|contents:\s*write|packages:\s*write|id-token:\s*write|fly deploy|gh release|upload-release-asset/i,
  );
  assert.match(
    workflow,
    /if: github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/,
  );
  assert.match(workflow, /build-tools;36\.0\.0/);
  assert.match(workflow, /require-ready:[\s\S]*?timeout-minutes: 45/);
  assert.equal((workflow.match(/^\s*run: npm run audit:security$/gm) ?? []).length, 1);
  assert.equal(
    (workflow.match(/^\s*run: npm run audit:security:require-clean$/gm) ?? []).length,
    1,
  );
  assert.equal((workflow.match(/^\s*run: npm run audit:security:smoke$/gm) ?? []).length, 1);
  assert.match(
    workflow,
    /uses: actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7\.0\.1/,
  );
  assert.match(workflow, /path: release\/evidence\/security-audit\.json/);
  assert.doesNotMatch(workflow, /if:\s*always\(\)/);
  assert.ok(
    workflow.indexOf("Reproduce sanitized public-history audit") <
      workflow.indexOf("Upload only the reproduced sanitized audit") &&
      workflow.indexOf("Upload only the reproduced sanitized audit") <
        workflow.indexOf("Refuse unresolved or stale security findings") &&
      workflow.indexOf("Refuse unresolved or stale security findings") <
        workflow.indexOf("Mint bounded cross-repository audit token") &&
      workflow.indexOf("Mint bounded cross-repository audit token") <
        workflow.indexOf("Refuse without complete proof"),
  );
  assert.equal((workflow.match(/^\s*run: npm ci$/gm) ?? []).length, 2);
  assert.equal((workflow.match(/^\s*cache: npm$/gm) ?? []).length, 2);
});

test("release validator uses an exact locked Sigstore dependency", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  );
  const packageLock = JSON.parse(
    readFileSync(new URL("../../package-lock.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(packageJson.devDependencies, { sigstore: "4.1.1" });
  assert.equal(packageLock.packages[""].devDependencies.sigstore, "4.1.1");
  assert.equal(packageLock.packages["node_modules/sigstore"].version, "4.1.1");
});
