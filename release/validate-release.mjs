#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

export const COMPONENT_POLICIES = Object.freeze({
  bridge: Object.freeze({
    repository: "https://github.com/ruizkinio/Jumpgate-bridge.git",
    branch: "main",
    slug: "ruizkinio/Jumpgate-bridge",
    workflow: "Bridge CI and Release",
    workflowId: 320575057,
    workflowPath: ".github/workflows/fly-deploy.yml",
    event: "push",
    auditedFiles: Object.freeze([
      Object.freeze({
        path: ".github/workflows/fly-deploy.yml",
        sha256: "2cda1aca12ff4a1a3b3e2f45c157660c21d1e212a6f32583551fbddddb55ddff",
      }),
      Object.freeze({
        path: "scripts/ci/fly-managed-rollout.js",
        sha256: "9cc954b815c012130e636f9fc2944873561efe7d1b3cf9f1bb7068f9cee7245f",
      }),
      Object.freeze({
        path: "scripts/ci/deployment-attestation.js",
        sha256: "8bdd29ef1c9ae853bf90ed438f39d1083ea05526779e553971833ee00c87ffc0",
      }),
      Object.freeze({
        path: "scripts/ci/http-smoke.js",
        sha256: "c1a658a8e17d4eed4041c71ac8834fe9ef254a59c9f075a81b10cdd83a223ff0",
      }),
      Object.freeze({
        path: "package.json",
        sha256: "0afead6fde8d3ed72e8f98d49f2883ef10d3917cbf646ce7a8828c1cdbe05d51",
      }),
      Object.freeze({
        path: "package-lock.json",
        sha256: "00e73f23ee5363e2e753d81e28cba047bc8bce7ba5a360be00608b792dd18016",
      }),
      Object.freeze({
        path: ".npmrc",
        sha256: "89570b4333de5a4920e113d299e774c671b4e83ebfe34757ad27c3960a7bd269",
      }),
      Object.freeze({
        path: "fly.toml",
        sha256: "723cfbe7a912d2d2bd0b70f7e113d6e676349825a5a875d250a891a09dc05c99",
      }),
    ]),
    requiredPullRequests: Object.freeze([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]),
  }),
  kodi: Object.freeze({
    repository: "https://github.com/ruizkinio/Jumpgate-kodi.git",
    branch: "master",
    slug: "ruizkinio/Jumpgate-kodi",
    workflow: "Jumpgate Android Release",
    workflowId: 321201768,
    workflowPath: ".github/workflows/jumpgate-android-release.yml",
    event: "workflow_dispatch",
    auditedFiles: Object.freeze([
      Object.freeze({
        path: ".github/workflows/jumpgate-android.yml",
        sha256: "7a4fc62b629aab57534406c5741f437bf4c28984612f1cac482b5fe560934de7",
      }),
      Object.freeze({
        path: ".github/workflows/jumpgate-android-release.yml",
        sha256: "2da415e9e4aac890e7a6f3bff388e4de2e674d36282ef1bca71681e0fd98fbc5",
      }),
      Object.freeze({
        path: ".github/workflows/jumpgate-release-reconcile.yml",
        sha256: "f84e9eac0662096705cdc907e2079f7a454fc4c39eacdf22d3dd3bd10eeca014",
      }),
      Object.freeze({
        path: "tools/ci/jumpgate/test-android-branding.py",
        sha256: "67b304ab140109a14bb630791fe6aeb6180ad6e7167456f759ecd29e76d5c4e6",
      }),
      Object.freeze({
        path: "tools/ci/jumpgate/test-jumpgate-android-release-workflow.py",
        sha256: "51622fcf737cb9b97df6e6d1697598623272caeb19f4b2ca6c873fee95b7a915",
      }),
      Object.freeze({
        path: "tools/ci/jumpgate/test-jumpgate-release-reconcile-workflow.py",
        sha256: "497212eea13f62412f264a1a664f82ec3552573fd634b6c2b15f05a89a6aa659",
      }),
      Object.freeze({
        path: "tools/ci/jumpgate/test-manager-addon.py",
        sha256: "057cccb48f3cef60f382f8b926f1820fc0e2c6fb61adfd80ea16f9c12437cf4f",
      }),
      Object.freeze({
        path: "tools/ci/jumpgate/test-verify-android-apk.sh",
        sha256: "2dbd5554946956b819ed3c04c274ff0383d7f5f79516d068b9b753ef068f6eba",
      }),
      Object.freeze({
        path: "tools/ci/jumpgate/test-verify-android-python-runtime.py",
        sha256: "2201bf08bac2c1804542abecb6399a2443a43b7571f724704acb0e333ddfb984",
      }),
      Object.freeze({
        path: "tools/ci/jumpgate/test-verify-android-release.sh",
        sha256: "6be01385d237f47c013df4647b0c6d355d33cce7c1ac9392682b18296e3e7520",
      }),
      Object.freeze({
        path: "tools/ci/jumpgate/test-verify-shairplay-crypto-symbols.sh",
        sha256: "36aec1fba5efa1b1aab13dd982ae41511010cc0e89e4293d125050158fe26de6",
      }),
      Object.freeze({
        path: "tools/ci/jumpgate/verify-android-apk.sh",
        sha256: "f9049f1ff977ac4b99241e4e33ed58fb1f6a0b05216b7a46dd94ba272e56a8f4",
      }),
      Object.freeze({
        path: "tools/ci/jumpgate/verify-android-python-runtime.py",
        sha256: "bd5f58f4e628ef20c3414f84c2244cf640721009e56e0507ea05d21cb4146a82",
      }),
      Object.freeze({
        path: "tools/ci/jumpgate/verify-android-release.sh",
        sha256: "e3225a51f07960ac099a4cc255fb061a98c2085e1d43e3fe496657ae49c710a5",
      }),
      Object.freeze({
        path: "tools/ci/jumpgate/verify-shairplay-crypto-symbols.sh",
        sha256: "53d88fe3fc957c2b245a501ddeeafd8f1d45a951721b703b960f1bdfab8daa90",
      }),
    ]),
    reviewedHistory: Object.freeze({
      upstreamBase: "c973d862b2435ecdf2b9b8cfc5aa47dfda15c5c0",
      developmentPullRequests: Object.freeze([2, 3, 4]),
      sourceTreePullRequest: 5,
      sourceBaseBranch: "master",
      finalTreePullRequest: 6,
      finalBaseBranch: "release/clean-history-v3",
      cleanAnchor: "d48dbc6df68826c39636a511a8d08496134d98a7",
      protectedBranch: "master",
      postCleanPullRequests: Object.freeze([7, 8, 10, 11, 12, 13, 14, 15, 16, 17]),
    }),
  }),
});

export const STREMIO_RELEASE_POLICY = Object.freeze({
  packageName: "com.stremio.one",
  downloadsOrigin: "https://dl.strem.io",
  signerCertificateSha256: "7e6a979c968f771e3fbcf2c2e8718ce61e708d87caf91fc13e2d4c19a8022c6b",
  abis: Object.freeze(["arm64-v8a", "armeabi-v7a"]),
  apps: Object.freeze({
    mobile: Object.freeze({
      deviceClass: "phone",
      versionName: "2.3.2",
      downloadChannel: "android",
    }),
    tv: Object.freeze({
      deviceClass: "tv",
      versionName: "1.10.4",
      downloadChannel: "androidTV",
    }),
  }),
});

export const KODI_RELEASE_POLICY = Object.freeze({
  apkManifest: Object.freeze({
    applicationId: "io.github.ruizkinio.jumpgate",
    versionCode: 2200300,
    versionName: "22.0-ALPHA2-Jumpgate-3.0.0",
  }),
  signer: Object.freeze({
    state: "provisioned",
    certificateSha256: "10625572b5f34c5125b030dd5ab5fd40bdcd263d0fa8e2073ddee70435970551",
  }),
});

export const PHYSICAL_EVIDENCE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const REQUIRED_SCENARIOS = Object.freeze([
  "installation-and-pairing",
  "standalone-kodi",
  "provider-matrix",
  "identity",
  "lifecycle",
  "trakt",
  "subtitles",
  "overlay-and-remote-control",
  "profiles",
]);

export const REQUIRED_UAT_CASES = Object.freeze([
  "installation-and-pairing/install-verified-apk",
  "installation-and-pairing/standalone-first-launch",
  "installation-and-pairing/manager-entrypoints",
  "installation-and-pairing/delayed-ui-responsive",
  "installation-and-pairing/code-forms-profile-bound",
  "installation-and-pairing/cancel-race-matrix",
  "installation-and-pairing/expiry-boundary",
  "installation-and-pairing/rate-limit-deadline",
  "installation-and-pairing/retry-generation-isolation",
  "installation-and-pairing/secure-commit",
  "installation-and-pairing/qr-artifact-lifecycle",
  "installation-and-pairing/activity-teardown",
  "installation-and-pairing/browser-account-link",
  "installation-and-pairing/install-gated-before-ready",
  "installation-and-pairing/stremio-result-contract",
  "installation-and-pairing/android-player-defaults",
  "standalone-kodi/upstream-behavior",
  "standalone-kodi/external-back-inactive",
  "standalone-kodi/profile-selection-inert",
  "standalone-kodi/catalog-browse-inert",
  "provider-matrix/aggregator",
  "provider-matrix/debrid",
  "provider-matrix/direct-http",
  "provider-matrix/playlist",
  "provider-matrix/non-mkv-container",
  "provider-matrix/torrent",
  "provider-matrix/signed-redirect",
  "provider-matrix/subtitle-text",
  "provider-matrix/subtitle-ass",
  "provider-matrix/subtitle-vobsub",
  "identity/canonical-exact",
  "identity/cross-provider-canonical",
  "identity/unknown-local-history",
  "identity/unknown-zero-trakt",
  "identity/no-heuristic-promotion",
  "identity/profile-nat-isolation",
  "lifecycle/start-first-frames",
  "lifecycle/pause-periodic-interval",
  "lifecycle/background-foreground",
  "lifecycle/resume",
  "lifecycle/seek",
  "lifecycle/back-result",
  "lifecycle/stremio-tv-premium-profile-return",
  "lifecycle/repeat-launch",
  "lifecycle/replacement-race",
  "lifecycle/completion-threshold",
  "lifecycle/no-stuck-ui-or-crash",
  "lifecycle/exact-result-delivery",
  "lifecycle/stale-callback-fence",
  "lifecycle/local-resume-restart",
  "lifecycle/standalone-after-external",
  "lifecycle/stremio-tv-premium-profile-picker-boundary",
  "trakt/no-event-before-claim",
  "trakt/start-once",
  "trakt/pause-suppresses-periodic",
  "trakt/resume-no-duplicate",
  "trakt/stop-identity-token-consistency",
  "trakt/background-paused",
  "trakt/replacement-ordering",
  "trakt/reauthorization-fail-closed",
  "subtitles/text-ass-fidelity",
  "subtitles/vobsub-atomic-pair",
  "subtitles/picker-controls",
  "subtitles/replacement-generation",
  "subtitles/playback-replacement-cancel",
  "subtitles/integrity-failures",
  "subtitles/kodi-addon-compatibility",
  "overlay-and-remote-control/canonical-display",
  "overlay-and-remote-control/clearlogo-fallback",
  "overlay-and-remote-control/bounded-cache",
  "overlay-and-remote-control/back-semantics",
  "overlay-and-remote-control/input-task-isolation",
  "profiles/two-profile-switch",
  "profiles/addon-authority-isolation",
  "profiles/removal-isolation",
  "profiles/no-exact-profile-local-only",
  "profiles/repair-history-boundary",
]);

export const SECURITY_SCOPES = Object.freeze({
  "ruizkinio/Jumpgate": "all-public-history",
  "ruizkinio/Jumpgate-bridge": "all-public-branches-and-tags",
  "ruizkinio/Jumpgate-kodi": "jumpgate-authored-public-ranges-and-branches",
});

export const KODI_UPSTREAM_REPOSITORY = "xbmc/xbmc";

export const GITLEAKS_POLICY = Object.freeze({
  scanner: "gitleaks",
  version: "8.30.1",
  linuxX64ArchiveUrl:
    "https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz",
  linuxX64ArchiveSha256: "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb",
  configSha256: "071bff1f6b205c83490d1f01b0db9070122c211c03e84c36cf0677fec1d9e993",
});

function fail(message) {
  throw new Error(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value, keys, path) {
  if (!isPlainObject(value)) {
    fail(`${path} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.join("\n") !== expected.join("\n")) {
    fail(`${path} must contain exactly: ${expected.join(", ")}`);
  }
}

function assertExactValue(actual, expected, path = "candidate") {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      fail(`${path} must match the locked candidate array`);
    }
    expected.forEach((value, index) =>
      assertExactValue(actual[index], value, `${path}[${index}]`),
    );
    return;
  }

  if (isPlainObject(expected)) {
    assertExactKeys(actual, Object.keys(expected), path);
    for (const key of Object.keys(expected)) {
      assertExactValue(actual[key], expected[key], `${path}.${key}`);
    }
    return;
  }

  if (actual !== expected) {
    fail(`${path} must be ${JSON.stringify(expected)}`);
  }
}

function assertHash(value, path) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    fail(`${path} must be a lowercase SHA-256`);
  }
}

function assertCommit(value, path) {
  if (typeof value !== "string" || !/^[0-9a-f]{40}$/.test(value)) {
    fail(`${path} must be a full lowercase Git commit SHA`);
  }
}

function assertDigest(value, path) {
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/.test(value)) {
    fail(`${path} must be a lowercase sha256 digest`);
  }
}

function parseHttpsUrl(value, path) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${path} must be a valid HTTPS URL`);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  ) {
    fail(`${path} must be a credential-free HTTPS URL without query or fragment`);
  }
  return url;
}

export function parseGithubActionsRunUrl(value, expectedSlug, path = "url") {
  const url = parseHttpsUrl(value, path);
  const escapedSlug = expectedSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^/${escapedSlug}/actions/runs/([1-9][0-9]*)$`).exec(
    url.pathname,
  );
  if (url.hostname !== "github.com" || !match) {
    fail(`${path} must identify an exact ${expectedSlug} Actions run`);
  }
  return match[1];
}

export function parseEvidenceBlobUrl(value, path = "evidenceUrl") {
  const url = parseHttpsUrl(value, path);
  const match =
    /^\/ruizkinio\/(Jumpgate|Jumpgate-kodi|Jumpgate-bridge)\/blob\/([0-9a-f]{40})\/([A-Za-z0-9][A-Za-z0-9._/+\-]*(?:\/[A-Za-z0-9][A-Za-z0-9._+\-]*)*)$/.exec(
      url.pathname,
    );
  if (url.hostname !== "github.com" || !match || match[3].split("/").includes("..")) {
    fail(`${path} must be an immutable public Jumpgate GitHub blob URL`);
  }
  return { repository: match[1], commit: match[2], filePath: match[3] };
}

function validateComponentIdentity(component, policy, path) {
  if (component.repository !== policy.repository || component.branch !== policy.branch) {
    fail(`${path} must use ${policy.repository}#${policy.branch}`);
  }
  assertCommit(component.commit, `${path}.commit`);
}

function assertPositiveInteger(value, path) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(`${path} must be a positive safe integer`);
  }
}

function validateArtifactDescriptor(artifact, path) {
  assertExactKeys(artifact, ["id", "name", "archiveDigest"], path);
  assertPositiveInteger(artifact.id, `${path}.id`);
  if (
    typeof artifact.name !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._+-]{0,199}$/.test(artifact.name)
  ) {
    fail(`${path}.name must be a bounded GitHub artifact name`);
  }
  assertDigest(artifact.archiveDigest, `${path}.archiveDigest`);
}

function validateProvenance(provenance, policy, path, extraKeys = []) {
  assertExactKeys(
    provenance,
    ["runUrl", "workflowId", "workflowPath", "event", "branch", "headRepository", ...extraKeys],
    path,
  );
  parseGithubActionsRunUrl(provenance.runUrl, policy.slug, `${path}.runUrl`);
  if (
    provenance.workflowId !== policy.workflowId ||
    provenance.workflowPath !== policy.workflowPath ||
    provenance.event !== policy.event ||
    provenance.branch !== policy.branch ||
    provenance.headRepository !== policy.slug
  ) {
    fail(
      `${path} must identify the protected ${policy.event} workflow on ` +
        `${policy.slug}#${policy.branch}`,
    );
  }
}

export function validateCandidate(candidate) {
  assertExactKeys(
    candidate,
    [
      "schemaVersion",
      "coordinatedVersion",
      "components",
      "stremio",
      "physicalUatEvidence",
      "securityAuditEvidence",
    ],
    "candidate",
  );
  if (candidate.schemaVersion !== 3) {
    fail("candidate.schemaVersion must be 3");
  }
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(candidate.coordinatedVersion)) {
    fail("candidate.coordinatedVersion must be a semantic version");
  }

  assertExactKeys(candidate.components, ["bridge", "kodi"], "candidate.components");

  const bridge = candidate.components.bridge;
  assertExactKeys(
    bridge,
    ["repository", "branch", "commit", "imageDigest", "provenance"],
    "candidate.components.bridge",
  );
  validateComponentIdentity(bridge, COMPONENT_POLICIES.bridge, "candidate.components.bridge");
  assertDigest(bridge.imageDigest, "candidate.components.bridge.imageDigest");
  validateProvenance(
    bridge.provenance,
    COMPONENT_POLICIES.bridge,
    "candidate.components.bridge.provenance",
    ["imageArtifact", "deploymentAttestationArtifact"],
  );
  validateArtifactDescriptor(
    bridge.provenance.imageArtifact,
    "candidate.components.bridge.provenance.imageArtifact",
  );
  if (bridge.provenance.deploymentAttestationArtifact !== null) {
    validateArtifactDescriptor(
      bridge.provenance.deploymentAttestationArtifact,
      "candidate.components.bridge.provenance.deploymentAttestationArtifact",
    );
  }

  const kodi = candidate.components.kodi;
  assertExactKeys(
    kodi,
    [
      "repository",
      "branch",
      "commit",
      "provenance",
      "artifacts",
    ],
    "candidate.components.kodi",
  );
  validateComponentIdentity(kodi, COMPONENT_POLICIES.kodi, "candidate.components.kodi");
  validateProvenance(
    kodi.provenance,
    COMPONENT_POLICIES.kodi,
    "candidate.components.kodi.provenance",
  );
  assertExactKeys(kodi.artifacts, ["arm64-v8a", "armeabi-v7a"], "candidate.components.kodi.artifacts");
  for (const abi of ["arm64-v8a", "armeabi-v7a"]) {
    const artifact = kodi.artifacts[abi];
    const path = `candidate.components.kodi.artifacts.${abi}`;
    assertExactKeys(
      artifact,
      [
        "artifactId",
        "artifactName",
        "archiveDigest",
        "apkSha256",
      ],
      path,
    );
    validateArtifactDescriptor(
      {
        id: artifact.artifactId,
        name: artifact.artifactName,
        archiveDigest: artifact.archiveDigest,
      },
      `${path}.githubArtifact`,
    );
    assertHash(artifact.apkSha256, `${path}.apkSha256`);
  }

  const stremio = candidate.stremio;
  assertExactKeys(stremio, ["packageName", "signerCertificateSha256", "apps"], "candidate.stremio");
  if (stremio.packageName !== STREMIO_RELEASE_POLICY.packageName) {
    fail("candidate.stremio.packageName must identify the supported Stremio Android package");
  }
  assertHash(stremio.signerCertificateSha256, "candidate.stremio.signerCertificateSha256");
  if (stremio.signerCertificateSha256 !== STREMIO_RELEASE_POLICY.signerCertificateSha256) {
    fail("candidate.stremio.signerCertificateSha256 must match the policy-locked Stremio signer");
  }
  assertExactKeys(stremio.apps, Object.keys(STREMIO_RELEASE_POLICY.apps), "candidate.stremio.apps");
  for (const [appName, appPolicy] of Object.entries(STREMIO_RELEASE_POLICY.apps)) {
    const app = stremio.apps[appName];
    const appPath = `candidate.stremio.apps.${appName}`;
    assertExactKeys(app, ["deviceClass", "versionName", "artifacts"], appPath);
    if (app.deviceClass !== appPolicy.deviceClass || app.versionName !== appPolicy.versionName) {
      fail(`${appPath} must match the policy-locked native Android baseline`);
    }
    assertExactKeys(app.artifacts, STREMIO_RELEASE_POLICY.abis, `${appPath}.artifacts`);
    for (const abi of STREMIO_RELEASE_POLICY.abis) {
      const artifact = app.artifacts[abi];
      const artifactPath = `${appPath}.artifacts.${abi}`;
      assertExactKeys(artifact, ["abi", "versionCode", "downloadUrl", "apkSha256"], artifactPath);
      if (artifact.abi !== abi) fail(`${artifactPath}.abi must match its artifact key`);
      assertPositiveInteger(artifact.versionCode, `${artifactPath}.versionCode`);
      assertHash(artifact.apkSha256, `${artifactPath}.apkSha256`);
      const expectedDownloadUrl =
        `${STREMIO_RELEASE_POLICY.downloadsOrigin}/android/` +
        `v${app.versionName}-${appPolicy.downloadChannel}/` +
        `${stremio.packageName}-${app.versionName}-${artifact.versionCode}-${abi}.apk`;
      if (artifact.downloadUrl !== expectedDownloadUrl) {
        fail(`${artifactPath}.downloadUrl must be the exact official versioned APK URL`);
      }
      parseHttpsUrl(artifact.downloadUrl, `${artifactPath}.downloadUrl`);
    }
  }
  if (candidate.physicalUatEvidence !== "release/evidence/physical-uat.json") {
    fail("candidate.physicalUatEvidence must use release/evidence/physical-uat.json");
  }
  if (candidate.securityAuditEvidence !== "release/evidence/security-audit.json") {
    fail("candidate.securityAuditEvidence must use release/evidence/security-audit.json");
  }
  return candidate;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function stremioCandidateSha256(stremio) {
  return createHash("sha256").update(canonicalJson(stremio)).digest("hex");
}

export function validateGitlinks(candidate, gitlinks) {
  const expected = new Map([
    ["stremio-addon", candidate.components.bridge.commit],
    ["xbmc", candidate.components.kodi.commit],
  ]);

  for (const [path, commit] of expected) {
    const entry = gitlinks.get(path);
    if (!entry || entry.mode !== "160000" || entry.commit !== commit) {
      fail(`${path} gitlink must be 160000 ${commit}`);
    }
  }
}

function assertPhysicalDevice(run, path) {
  const label = `${run.manufacturer} ${run.model}`;
  if (
    typeof run.manufacturer !== "string" ||
    typeof run.model !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9 ._()+-]{1,79}$/.test(run.manufacturer) ||
    !/^[A-Za-z0-9][A-Za-z0-9 ._()+-]{1,79}$/.test(run.model)
  ) {
    fail(`${path} manufacturer and model must be sanitized device labels`);
  }
  if (/(emulator|simulator|sdk[_ -]?gphone|android sdk|qemu|avd|virtualbox|genymotion)/i.test(label)) {
    fail(`${path} must identify a physical device, not a virtual device`);
  }
}

export function releaseSignerIsProvisioned(policy = KODI_RELEASE_POLICY.signer) {
  if (policy?.state === "not-yet-provisioned" && policy.certificateSha256 === null) {
    return false;
  }
  if (policy?.state === "provisioned") {
    assertHash(policy.certificateSha256, "Kodi release signer policy certificateSha256");
    return true;
  }
  fail("Kodi release signer policy must be explicitly provisioned or not-yet-provisioned");
}

export function validateEvidence(
  evidence,
  candidate,
  now = new Date(),
  releaseSignerPolicy = KODI_RELEASE_POLICY.signer,
) {
  assertExactKeys(evidence, ["schemaVersion", "candidate", "runs"], "evidence");
  if (evidence.schemaVersion !== 2) {
    fail("evidence.schemaVersion must be 2");
  }

  assertExactKeys(
    evidence.candidate,
    [
      "coordinatedVersion",
      "bridgeCommit",
      "bridgeImageDigest",
      "kodiCommit",
      "stremioCandidateSha256",
    ],
    "evidence.candidate",
  );
  assertExactValue(
    evidence.candidate,
    {
      coordinatedVersion: candidate.coordinatedVersion,
      bridgeCommit: candidate.components.bridge.commit,
      bridgeImageDigest: candidate.components.bridge.imageDigest,
      kodiCommit: candidate.components.kodi.commit,
      stremioCandidateSha256: stremioCandidateSha256(candidate.stremio),
    },
    "evidence.candidate",
  );

  if (!Array.isArray(evidence.runs) || evidence.runs.length !== 2) {
    fail("evidence.runs must contain exactly one physical phone and one physical TV record");
  }

  const seenClasses = new Set();
  const seenDevices = new Set();
  const seenReports = new Set();
  for (const [index, run] of evidence.runs.entries()) {
    const path = `evidence.runs[${index}]`;
    assertExactKeys(
      run,
      [
        "deviceClass",
        "manufacturer",
        "model",
        "androidApi",
        "abi",
        "testedAt",
        "jumpgateApkSha256",
        "jumpgateSignerSha256",
        "stremioPackageName",
        "stremioVersionName",
        "stremioVersionCode",
        "stremioApkSha256",
        "stremioSignerSha256",
        "evidenceSha256",
        "evidenceUrl",
        "caseCount",
      ],
      path,
    );

    if (!new Set(["phone", "tv"]).has(run.deviceClass)) {
      fail(`${path}.deviceClass must be phone or tv`);
    }
    if (seenClasses.has(run.deviceClass)) {
      fail("evidence.runs must contain one phone and one TV record");
    }
    seenClasses.add(run.deviceClass);

    assertPhysicalDevice(run, path);
    const deviceKey = `${run.manufacturer}\n${run.model}`.toLowerCase();
    if (seenDevices.has(deviceKey)) {
      fail("phone and TV evidence must identify different physical devices");
    }
    seenDevices.add(deviceKey);

    if (!Number.isInteger(run.androidApi) || run.androidApi < 24 || run.androidApi > 99) {
      fail(`${path}.androidApi must be a supported Android API integer`);
    }
    if (!new Set(["arm64-v8a", "armeabi-v7a"]).has(run.abi)) {
      fail(`${path}.abi must be arm64-v8a or armeabi-v7a`);
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(run.testedAt)) {
      fail(`${path}.testedAt must be an RFC 3339 UTC timestamp`);
    }
    const testedAt = new Date(run.testedAt);
    const age = now.valueOf() - testedAt.valueOf();
    if (Number.isNaN(testedAt.valueOf()) || age < -300_000) {
      fail(`${path}.testedAt must be a valid completed test time`);
    }
    if (age > PHYSICAL_EVIDENCE_MAX_AGE_MS) {
      fail(`${path}.testedAt is older than the 30-day release evidence window`);
    }

    assertHash(run.jumpgateApkSha256, `${path}.jumpgateApkSha256`);
    assertHash(run.jumpgateSignerSha256, `${path}.jumpgateSignerSha256`);
    const artifact = candidate.components.kodi.artifacts[run.abi];
    if (run.jumpgateApkSha256 !== artifact.apkSha256) {
      fail(`${path} must use the locked ${run.abi} APK`);
    }
    if (
      releaseSignerIsProvisioned(releaseSignerPolicy) &&
      run.jumpgateSignerSha256 !== releaseSignerPolicy.certificateSha256
    ) {
      fail(`${path} must use the policy-locked Kodi release signer`);
    }
    assertHash(run.stremioApkSha256, `${path}.stremioApkSha256`);
    assertHash(run.stremioSignerSha256, `${path}.stremioSignerSha256`);
    const stremioAppName = run.deviceClass === "phone" ? "mobile" : "tv";
    const stremioApp = candidate.stremio.apps[stremioAppName];
    const stremioArtifact = stremioApp.artifacts[run.abi];
    if (
      run.stremioPackageName !== candidate.stremio.packageName ||
      run.stremioVersionName !== stremioApp.versionName ||
      run.stremioVersionCode !== stremioArtifact.versionCode ||
      run.stremioApkSha256 !== stremioArtifact.apkSha256 ||
      run.stremioSignerSha256 !== candidate.stremio.signerCertificateSha256
    ) {
      fail(`${path} must use the exact locked Stremio ${stremioAppName} ${run.abi} APK`);
    }
    if (run.caseCount !== REQUIRED_UAT_CASES.length) {
      fail(`${path}.caseCount must cover every required UAT case`);
    }
    assertHash(run.evidenceSha256, `${path}.evidenceSha256`);
    parseEvidenceBlobUrl(run.evidenceUrl, `${path}.evidenceUrl`);
    const reportKey = `${run.evidenceUrl}\n${run.evidenceSha256}`;
    if (seenReports.has(reportKey)) {
      fail("phone and TV must use distinct immutable evidence reports");
    }
    seenReports.add(reportKey);
  }
  return evidence;
}

export function validateUatReport(report, run, candidate) {
  assertExactKeys(
    report,
    ["schemaVersion", "candidate", "device", "testedAt", "bridge", "cases"],
    "UAT report",
  );
  if (report.schemaVersion !== 2) fail("UAT report schemaVersion must be 2");
  assertExactValue(report.candidate, {
    coordinatedVersion: candidate.coordinatedVersion,
    bridgeCommit: candidate.components.bridge.commit,
    bridgeImageDigest: candidate.components.bridge.imageDigest,
    kodiCommit: candidate.components.kodi.commit,
    stremioCandidateSha256: stremioCandidateSha256(candidate.stremio),
  }, "UAT report.candidate");
  assertExactValue(report.device, {
    deviceClass: run.deviceClass,
    manufacturer: run.manufacturer,
    model: run.model,
    androidApi: run.androidApi,
    abi: run.abi,
    jumpgateApkSha256: run.jumpgateApkSha256,
    jumpgateSignerSha256: run.jumpgateSignerSha256,
    stremioPackageName: run.stremioPackageName,
    stremioVersionName: run.stremioVersionName,
    stremioVersionCode: run.stremioVersionCode,
    stremioApkSha256: run.stremioApkSha256,
    stremioSignerSha256: run.stremioSignerSha256,
  }, "UAT report.device");
  if (report.testedAt !== run.testedAt) fail("UAT report.testedAt must match its index record");
  assertExactValue(report.bridge, {
    version: candidate.coordinatedVersion,
    buildSha: candidate.components.bridge.commit,
    imageDigest: candidate.components.bridge.imageDigest,
  }, "UAT report.bridge");
  if (!Array.isArray(report.cases) || report.cases.length !== REQUIRED_UAT_CASES.length) {
    fail("UAT report must contain every required case exactly once");
  }
  const actualIds = [];
  for (const [index, result] of report.cases.entries()) {
    const path = `UAT report.cases[${index}]`;
    assertExactKeys(result, ["id", "status", "observation"], path);
    if (result.status !== "pass") fail(`${path}.status must be pass`);
    if (
      typeof result.observation !== "string" ||
      result.observation.length < 1 ||
      result.observation.length > 500 ||
      result.observation.trim() !== result.observation ||
      /[\u0000-\u001f\u007f]/.test(result.observation)
    ) {
      fail(`${path}.observation must be bounded sanitized evidence text`);
    }
    actualIds.push(result.id);
  }
  if (
    new Set(actualIds).size !== actualIds.length ||
    [...actualIds].sort().join("\n") !== [...REQUIRED_UAT_CASES].sort().join("\n")
  ) {
    fail("UAT report must contain every required case exactly once");
  }
  return report;
}

function validateFindingFingerprints(fingerprints, path) {
  if (!Array.isArray(fingerprints) || fingerprints.length > 100_000) {
    fail(`${path} must be a bounded array`);
  }
  let previous = null;
  for (const [index, fingerprint] of fingerprints.entries()) {
    assertHash(fingerprint, `${path}[${index}]`);
    if (previous !== null && fingerprint <= previous) {
      fail(`${path} must be sorted and unique`);
    }
    previous = fingerprint;
  }
  return fingerprints;
}

function validateSecurityFindingPath(value, path) {
  if (typeof value !== "string" || value.length < 1 || value.length > 4096) {
    fail(`${path} is invalid`);
  }
  const segments = value.split("/");
  if (
    value.startsWith("/") ||
    value.includes("\\") ||
    /^[A-Za-z]:\//.test(value) ||
    segments.some((segment) => !segment || segment === "." || segment === "..") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    fail(`${path} must be a normalized repository-relative path`);
  }
  return value;
}

function validateSecurityLocationInteger(value, path, minimum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > 1_000_000_000) {
    fail(`${path} is invalid`);
  }
  return value;
}

export function securityFindingFingerprint(record) {
  const canonical = {
    rule: record.rule,
    commit: record.commit,
    path: record.path,
    startLine: record.startLine,
    endLine: record.endLine,
    startColumn: record.startColumn,
    endColumn: record.endColumn,
  };
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

function validateSecurityFindingRecords(records, path) {
  if (!Array.isArray(records) || records.length > 100_000) {
    fail(`${path} must be a bounded array`);
  }
  let previous = null;
  for (const [index, record] of records.entries()) {
    const recordPath = `${path}[${index}]`;
    assertExactKeys(
      record,
      [
        "fingerprint",
        "rule",
        "commit",
        "path",
        "startLine",
        "endLine",
        "startColumn",
        "endColumn",
      ],
      recordPath,
    );
    assertHash(record.fingerprint, `${recordPath}.fingerprint`);
    if (
      typeof record.rule !== "string" ||
      record.rule.length < 1 ||
      record.rule.length > 200 ||
      !/^[A-Za-z0-9][A-Za-z0-9._:+/-]*$/.test(record.rule)
    ) {
      fail(`${recordPath}.rule is invalid`);
    }
    assertCommit(record.commit, `${recordPath}.commit`);
    validateSecurityFindingPath(record.path, `${recordPath}.path`);
    validateSecurityLocationInteger(record.startLine, `${recordPath}.startLine`, 1);
    validateSecurityLocationInteger(record.endLine, `${recordPath}.endLine`, 1);
    validateSecurityLocationInteger(record.startColumn, `${recordPath}.startColumn`, 0);
    validateSecurityLocationInteger(record.endColumn, `${recordPath}.endColumn`, 0);
    if (record.endLine < record.startLine) fail(`${recordPath} line range is invalid`);
    if (securityFindingFingerprint(record) !== record.fingerprint) {
      fail(`${recordPath}.fingerprint must derive from the sanitized location record`);
    }
    if (previous !== null && record.fingerprint <= previous) {
      fail(`${path} must be sorted by unique fingerprint`);
    }
    previous = record.fingerprint;
  }
  return records;
}

export function validatePublicRefManifest(refs, path = "security report.refs") {
  if (!Array.isArray(refs) || refs.length < 1 || refs.length > 2_000) {
    fail(`${path} must be a bounded non-empty array`);
  }
  let previous = null;
  for (const [index, entry] of refs.entries()) {
    const entryPath = `${path}[${index}]`;
    assertExactKeys(entry, ["name", "objectId"], entryPath);
    assertCommit(entry.objectId, `${entryPath}.objectId`);
    if (typeof entry.name !== "string") {
      fail(`${entryPath}.name is not a safe public head or tag ref`);
    }
    const peeled = entry.name.endsWith("^{}");
    const baseName = peeled ? entry.name.slice(0, -3) : entry.name;
    if (
      entry.name.length > 300 ||
      !/^refs\/(?:heads|tags)\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(baseName) ||
      (peeled && !baseName.startsWith("refs/tags/")) ||
      baseName.includes("..") ||
      baseName.includes("//") ||
      baseName.includes("@{") ||
      baseName.endsWith(".") ||
      baseName.split("/").some((part) => part.startsWith(".") || part.endsWith(".lock"))
    ) {
      fail(`${entryPath}.name is not a safe public head or tag ref`);
    }
    if (previous !== null && entry.name <= previous) {
      fail(`${path} must be sorted by unique ref name`);
    }
    previous = entry.name;
  }
  return refs;
}

export function publicRefManifestSha256(refs) {
  validatePublicRefManifest(refs);
  const canonical = refs.map((entry) => `${entry.objectId}\t${entry.name}\n`).join("");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function verifyCurrentPublicRefManifest(recorded, current) {
  validatePublicRefManifest(recorded, "recorded public refs");
  validatePublicRefManifest(current, "current public refs");
  if (JSON.stringify(recorded) !== JSON.stringify(current)) {
    fail("security report public refs do not match the current remote heads and tags");
  }
  return true;
}

function securityCommands(repository) {
  const commands = [
    "git ls-remote --heads --tags",
    "git fetch --filter=blob:none --no-tags --stdin into refs/jumpgate-audit/public",
  ];
  if (repository === "ruizkinio/Jumpgate-kodi") {
    commands.push(
      "git fetch --filter=blob:none --no-tags --stdin into refs/jumpgate-audit/upstream",
      "gitleaks git --redact=100 --log-opts=--full-history --diff-filter=tuxdb --all --not --glob=refs/jumpgate-audit/upstream/*",
    );
  } else {
    commands.push(
      "gitleaks git --redact=100 --log-opts=--full-history --diff-filter=tuxdb --all",
    );
  }
  return commands;
}

export function validateSecurityAllowlist(allowlist, completedAt) {
  assertExactKeys(allowlist, ["schemaVersion", "entries"], "security allowlist");
  if (allowlist.schemaVersion !== 1) fail("security allowlist schemaVersion must be 1");
  if (!Array.isArray(allowlist.entries) || allowlist.entries.length > 100_000) {
    fail("security allowlist.entries must be a bounded array");
  }
  let previous = null;
  for (const [index, entry] of allowlist.entries.entries()) {
    const path = `security allowlist.entries[${index}]`;
    assertExactKeys(entry, ["repository", "fingerprint", "reason", "expiresAt"], path);
    if (!Object.hasOwn(SECURITY_SCOPES, entry.repository)) {
      fail(`${path}.repository is not a public Jumpgate repository`);
    }
    assertHash(entry.fingerprint, `${path}.fingerprint`);
    if (
      typeof entry.reason !== "string" ||
      entry.reason.length < 10 ||
      entry.reason.length > 300 ||
      entry.reason.trim() !== entry.reason ||
      /[\u0000-\u001f\u007f]/.test(entry.reason)
    ) {
      fail(`${path}.reason must be a concise sanitized review rationale`);
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(entry.expiresAt)) {
      fail(`${path}.expiresAt must be an RFC 3339 UTC timestamp without fractions`);
    }
    const expiresAt = new Date(entry.expiresAt);
    if (Number.isNaN(expiresAt.valueOf()) || expiresAt <= completedAt) {
      fail(`${path} is expired`);
    }
    const key = `${entry.repository}\n${entry.fingerprint}`;
    if (previous !== null && key <= previous) {
      fail("security allowlist entries must be sorted and unique");
    }
    previous = key;
  }
  return allowlist;
}

function validateReviewedRanges(record, path) {
  const publicRefs = record.refs.filter((entry) => !entry.name.endsWith("^{}"));
  if (!Array.isArray(record.reviewedRanges) || record.reviewedRanges.length !== publicRefs.length) {
    fail(`${path}.reviewedRanges must cover every public head and tag exactly once`);
  }
  const isKodi = record.repository === "ruizkinio/Jumpgate-kodi";
  for (const [index, range] of record.reviewedRanges.entries()) {
    const rangePath = `${path}.reviewedRanges[${index}]`;
    assertExactKeys(range, ["ref", "tip", "selection", "excludedRefsSha256"], rangePath);
    const publicRef = publicRefs[index];
    if (range.ref !== publicRef.name || range.tip !== publicRef.objectId) {
      fail(`${rangePath} must match the sorted public ref manifest`);
    }
    const expectedSelection = isKodi
      ? "tip-minus-upstream-public-history"
      : "reachable-history";
    if (range.selection !== expectedSelection) {
      fail(`${rangePath}.selection must match the repository audit scope`);
    }
    const expectedExclusion = isKodi ? record.upstream.auditedRefsSha256 : null;
    if (range.excludedRefsSha256 !== expectedExclusion) {
      fail(`${rangePath}.excludedRefsSha256 must bind the exact exclusion set`);
    }
  }
}

export function validateSecurityReport(
  report,
  scanner,
  allowlistEntries = [],
  requireResolved = true,
) {
  assertExactKeys(
    report,
    [
      "repository",
      "scope",
      "refs",
      "auditedRefsSha256",
      "upstream",
      "reviewedRanges",
      "rawFindings",
      "allowlistedFindingFingerprints",
      "unresolvedFindingFingerprints",
      "commands",
    ],
    "security report",
  );
  if (!Object.hasOwn(SECURITY_SCOPES, report.repository)) {
    fail("security report.repository is not a public Jumpgate repository");
  }
  if (report.scope !== SECURITY_SCOPES[report.repository]) {
    fail("security report.scope must match the repository audit scope");
  }
  validatePublicRefManifest(report.refs, "security report.refs");
  if (publicRefManifestSha256(report.refs) !== report.auditedRefsSha256) {
    fail("security report auditedRefsSha256 must derive from its exact public ref manifest");
  }
  if (report.repository === "ruizkinio/Jumpgate-kodi") {
    assertExactKeys(
      report.upstream,
      ["repository", "refs", "auditedRefsSha256"],
      "security report.upstream",
    );
    if (report.upstream.repository !== KODI_UPSTREAM_REPOSITORY) {
      fail("security report.upstream must use the official Kodi repository");
    }
    validatePublicRefManifest(report.upstream.refs, "security report.upstream.refs");
    if (publicRefManifestSha256(report.upstream.refs) !== report.upstream.auditedRefsSha256) {
      fail("security report upstream hash must derive from its exact public ref manifest");
    }
  } else if (report.upstream !== null) {
    fail("only the Kodi audit may exclude exact official upstream history");
  }
  validateReviewedRanges(report, "security report");

  const raw = validateSecurityFindingRecords(report.rawFindings, "security report.rawFindings")
    .map((record) => record.fingerprint);
  const allowlisted = validateFindingFingerprints(
    report.allowlistedFindingFingerprints,
    "security report.allowlistedFindingFingerprints",
  );
  const unresolved = validateFindingFingerprints(
    report.unresolvedFindingFingerprints,
    "security report.unresolvedFindingFingerprints",
  );
  const expectedAllowlisted = allowlistEntries
    .filter((entry) => entry.repository === report.repository)
    .map((entry) => entry.fingerprint);
  if (expectedAllowlisted.join("\n") !== allowlisted.join("\n")) {
    fail("security report must use every exact repository allowlist entry");
  }
  const rawSet = new Set(raw);
  if (allowlisted.some((fingerprint) => !rawSet.has(fingerprint))) {
    fail("security report contains a stale or unused allowlist entry");
  }
  const allowlistedSet = new Set(allowlisted);
  const expectedUnresolved = raw.filter((fingerprint) => !allowlistedSet.has(fingerprint));
  if (expectedUnresolved.join("\n") !== unresolved.join("\n")) {
    fail("security report unresolved findings must equal raw findings minus the allowlist");
  }
  if (requireResolved && unresolved.length !== 0) {
    fail("security report unresolved findings must be zero");
  }
  assertExactValue(report.commands, securityCommands(report.repository), "security report.commands");
  if (
    scanner.name !== GITLEAKS_POLICY.scanner ||
    scanner.version !== GITLEAKS_POLICY.version ||
    scanner.archiveSha256 !== GITLEAKS_POLICY.linuxX64ArchiveSha256 ||
    scanner.configSha256 !== GITLEAKS_POLICY.configSha256
  ) {
    fail("security report must use the policy-pinned Gitleaks build and configuration");
  }
  return report;
}

export function validateSecurityAudit(
  evidence,
  candidate,
  now = new Date(),
  allowlist = { schemaVersion: 1, entries: [] },
  allowlistSha256 = null,
  requireResolved = true,
) {
  assertExactKeys(
    evidence,
    [
      "schemaVersion",
      "candidate",
      "completedAt",
      "scanner",
      "allowlistSha256",
      "repositories",
    ],
    "security audit",
  );
  if (evidence.schemaVersion !== 4) fail("security audit schemaVersion must be 4");
  assertExactValue(evidence.candidate, {
    bridgeCommit: candidate.components.bridge.commit,
    kodiCommit: candidate.components.kodi.commit,
  }, "security audit.candidate");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(evidence.completedAt)) {
    fail("security audit.completedAt must be an RFC 3339 UTC timestamp");
  }
  const completedAt = new Date(evidence.completedAt);
  const age = now.valueOf() - completedAt.valueOf();
  if (Number.isNaN(completedAt.valueOf()) || age < -300_000 || age > PHYSICAL_EVIDENCE_MAX_AGE_MS) {
    fail("security audit must be completed within the 30-day release window");
  }
  assertExactKeys(
    evidence.scanner,
    ["name", "version", "archiveSha256", "configSha256"],
    "security audit.scanner",
  );
  validateSecurityAllowlist(allowlist, completedAt);
  assertHash(evidence.allowlistSha256, "security audit.allowlistSha256");
  if (allowlistSha256 !== null && evidence.allowlistSha256 !== allowlistSha256) {
    fail("security audit allowlist hash does not match the tracked policy bytes");
  }
  if (!Array.isArray(evidence.repositories) || evidence.repositories.length !== 3) {
    fail("security audit must cover all three public Jumpgate repositories");
  }
  const expectedRepositories = Object.keys(SECURITY_SCOPES);
  evidence.repositories.forEach((record, index) => {
    if (record.repository !== expectedRepositories[index]) {
      fail("security audit repositories must use the exact policy order");
    }
    validateSecurityReport(record, evidence.scanner, allowlist.entries, requireResolved);
  });
  return evidence;
}

export function commitContainsAncestor(compare, ancestor, descendant) {
  if (ancestor === descendant) {
    return true;
  }
  if (!isPlainObject(compare)) {
    return false;
  }
  return (
    new Set(["ahead", "identical"]).has(compare.status) &&
    compare.base_commit?.sha === ancestor &&
    compare.merge_base_commit?.sha === ancestor
  );
}

export function readinessBlockers({
  stremioArtifactProof,
  physicalEvidence,
  securityAudit,
  liveSecurityProof,
  kodiArtifactProof,
  bridgeAttestationProof,
  missingPullRequests,
  releaseSignerPolicy = KODI_RELEASE_POLICY.signer,
}) {
  const blockers = [];
  if (missingPullRequests.length) {
    blockers.push(
      `required component review/history proofs are incomplete: ${missingPullRequests.join(", ")}`,
    );
  }
  const releaseSignerProvisioned = releaseSignerIsProvisioned(releaseSignerPolicy);
  if (!releaseSignerProvisioned) {
    blockers.push("the Kodi release signer is explicitly not yet provisioned; current APKs are ephemeral");
  } else if (!kodiArtifactProof) {
    blockers.push(
      "the locked APK bytes, manifests, and signing certificates have not been independently verified",
    );
  }
  if (!bridgeAttestationProof) {
    blockers.push("the deployed Bridge digest lacks a candidate-bound deployment attestation artifact");
  }
  if (!stremioArtifactProof) {
    blockers.push(
      "the locked Stremio APK bytes, manifests, ABI sets, and signing certificate have not been independently verified",
    );
  }
  if (!physicalEvidence) {
    blockers.push("sanitized physical phone and TV UAT evidence is absent");
  }
  if (!securityAudit) {
    blockers.push("bounded secret/history audit evidence is absent");
  } else if (!liveSecurityProof) {
    blockers.push("current GitHub code-scanning or secret-scanning state is not clean");
  }
  return blockers;
}

function readGitlinks(root) {
  const output = execFileSync(
    "git",
    ["ls-files", "--stage", "--", "stremio-addon", "xbmc"],
    { cwd: root, encoding: "utf8" },
  );
  const entries = new Map();
  for (const line of output.trim().split(/\r?\n/).filter(Boolean)) {
    const match = /^(\d{6}) ([0-9a-f]{40}) \d+\t(.+)$/.exec(line);
    if (!match) {
      fail(`unable to parse git index entry: ${line}`);
    }
    entries.set(match[3], { mode: match[1], commit: match[2] });
  }
  return entries;
}

function pathIsTracked(root, path) {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", path], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function gitLsRemote(repository, refs) {
  const output = execFileSync("git", ["ls-remote", repository, ...refs], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const result = new Map();
  for (const line of output.trim().split(/\r?\n/).filter(Boolean)) {
    const [commit, ref] = line.split(/\s+/, 2);
    result.set(ref, commit);
  }
  return result;
}

function currentPublicRefManifest(repository) {
  return [...gitLsRemote(repository, ["refs/heads/*", "refs/tags/*"]).entries()]
    .map(([name, objectId]) => ({ name, objectId }))
    .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
}

function requestHeaders(url) {
  const headers = { "User-Agent": "Jumpgate-release-readiness-validator" };
  if (url.startsWith("https://api.github.com/") && process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchResponse(url) {
  const response = await fetch(url, { headers: requestHeaders(url), redirect: "error" });
  if (!response.ok) {
    fail(`public proof request failed with HTTP ${response.status}: ${url}`);
  }
  return response;
}

async function fetchText(url) {
  return (await fetchResponse(url)).text();
}

async function fetchJson(url) {
  const text = await fetchText(url);
  try {
    return JSON.parse(text);
  } catch {
    fail(`public proof response was not JSON: ${url}`);
  }
}

async function fetchBytes(url) {
  return Buffer.from(await (await fetchResponse(url)).arrayBuffer());
}

async function fetchBoundedBytes(url, maximumBytes) {
  const response = await fetchResponse(url);
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    fail(`public artifact exceeds its verification limit: ${url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1 || bytes.length > maximumBytes) {
    fail(`public artifact has an invalid size: ${url}`);
  }
  return bytes;
}

export async function verifyComponentAuditedFiles(
  component,
  policy,
  name,
  loadBytes = fetchBytes,
) {
  if (!Array.isArray(policy.auditedFiles) || policy.auditedFiles.length < 1) {
    fail(`${name} audited file policy is missing`);
  }
  const seen = new Set();
  const verified = {};
  for (const [index, descriptor] of policy.auditedFiles.entries()) {
    const path = `${name} audited file policy[${index}]`;
    assertExactKeys(descriptor, ["path", "sha256"], path);
    if (
      typeof descriptor.path !== "string" ||
      descriptor.path.length > 200 ||
      !/^[A-Za-z0-9.][A-Za-z0-9._/+\-]*$/.test(descriptor.path) ||
      descriptor.path.split("/").some((segment) => !segment || segment === "." || segment === "..") ||
      seen.has(descriptor.path)
    ) {
      fail(`${name} audited file path is unsafe or duplicated`);
    }
    assertHash(descriptor.sha256, `${path}.sha256`);
    seen.add(descriptor.path);
    const url =
      `https://raw.githubusercontent.com/${policy.slug}/${component.commit}/${descriptor.path}`;
    const bytes = Buffer.from(await loadBytes(url));
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== descriptor.sha256) {
      fail(`${name} audited bytes at the candidate commit do not match policy`);
    }
    verified[descriptor.path] = actual;
  }
  return Object.freeze(verified);
}

async function fetchArtifactBytes(url, maximumBytes) {
  if (!process.env.GITHUB_TOKEN) {
    fail("GITHUB_TOKEN is required to verify Actions artifact bytes");
  }
  const response = await fetch(url, {
    headers: requestHeaders(url),
    redirect: "follow",
  });
  if (!response.ok || response.url.startsWith("http://")) {
    fail(`Actions artifact download failed with HTTP ${response.status}`);
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    fail("Actions artifact archive exceeds its verification limit");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1 || bytes.length > maximumBytes) {
    fail("Actions artifact archive has an invalid size");
  }
  return bytes;
}

export function parseZipEntries(archive) {
  if (!Buffer.isBuffer(archive) || archive.length < 22) fail("ZIP archive is invalid");
  const minimum = Math.max(0, archive.length - 65_557);
  let eocd = -1;
  for (let offset = archive.length - 22; offset >= minimum; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) fail("ZIP end record is missing");
  const count = archive.readUInt16LE(eocd + 10);
  const centralSize = archive.readUInt32LE(eocd + 12);
  const centralOffset = archive.readUInt32LE(eocd + 16);
  if (
    count < 1 ||
    count > 20_000 ||
    centralOffset + centralSize > eocd ||
    centralOffset < 0
  ) {
    fail("ZIP central directory is invalid");
  }
  const entries = new Map();
  let offset = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > archive.length || archive.readUInt32LE(offset) !== 0x02014b50) {
      fail("ZIP central entry is invalid");
    }
    const flags = archive.readUInt16LE(offset + 8);
    const method = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const size = archive.readUInt32LE(offset + 24);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > archive.length || flags & 0x0001 || !new Set([0, 8]).has(method)) {
      fail("ZIP entry uses unsupported or encrypted encoding");
    }
    const name = archive.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (
      !name ||
      name.length > 500 ||
      name.includes("\\") ||
      name.startsWith("/") ||
      name.split("/").includes("..") ||
      /[\u0000-\u001f\u007f]/.test(name) ||
      entries.has(name)
    ) {
      fail("ZIP entry name is unsafe or duplicated");
    }
    entries.set(name, { method, compressedSize, size, localOffset });
    offset = next;
  }
  if (offset !== centralOffset + centralSize) fail("ZIP central directory size is inconsistent");
  return entries;
}

export function extractZipEntry(archive, entries, name, maximumBytes) {
  const entry = entries.get(name);
  if (!entry || entry.size > maximumBytes) fail(`ZIP entry is missing or oversized: ${name}`);
  const offset = entry.localOffset;
  if (offset + 30 > archive.length || archive.readUInt32LE(offset) !== 0x04034b50) {
    fail("ZIP local entry is invalid");
  }
  const nameLength = archive.readUInt16LE(offset + 26);
  const extraLength = archive.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > archive.length) fail("ZIP entry payload is truncated");
  const compressed = archive.subarray(start, end);
  const bytes = entry.method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed);
  if (bytes.length !== entry.size || bytes.length > maximumBytes) {
    fail("ZIP entry size does not match its central record");
  }
  return bytes;
}

export function validateApkNativeAbi(apk, abi, label = "APK") {
  const entries = parseZipEntries(apk);
  const nativeAbis = new Set(
    [...entries.keys()]
      .map((name) => /^lib\/([^/]+)\/[^/]+\.so$/.exec(name)?.[1])
      .filter(Boolean),
  );
  if (nativeAbis.size !== 1 || !nativeAbis.has(abi)) {
    fail(`${label} native library set does not match ${abi}`);
  }
  return abi;
}

async function githubCompare(slug, ancestor, descendant) {
  if (ancestor === descendant) {
    return null;
  }
  return fetchJson(`https://api.github.com/repos/${slug}/compare/${ancestor}...${descendant}`);
}

async function verifyComponentCommit(component, policy, name) {
  const ref = `refs/heads/${component.branch}`;
  const remote = gitLsRemote(component.repository, [ref]);
  const branchHead = remote.get(ref);
  if (!branchHead) {
    fail(`${name} public branch does not exist`);
  }
  const compare = await githubCompare(policy.slug, component.commit, branchHead);
  if (!commitContainsAncestor(compare, component.commit, branchHead)) {
    fail(`${name} candidate commit is not reachable from the configured public branch`);
  }
}

export function expectedWorkflowRunName(component, policy, coordinatedVersion) {
  return policy.event === "workflow_dispatch"
    ? `Release v${coordinatedVersion} from ${component.commit}`
    : policy.workflow;
}

async function verifyProvenanceRun(component, policy, name, coordinatedVersion) {
  const provenance = component.provenance;
  const runId = parseGithubActionsRunUrl(provenance.runUrl, policy.slug);
  const run = await fetchJson(`https://api.github.com/repos/${policy.slug}/actions/runs/${runId}`);
  const expectedRunName = expectedWorkflowRunName(component, policy, coordinatedVersion);
  if (
    run.html_url !== provenance.runUrl ||
    run.head_sha !== component.commit ||
    run.name !== expectedRunName ||
    run.workflow_id !== policy.workflowId ||
    run.path !== policy.workflowPath ||
    run.event !== provenance.event ||
    run.head_branch !== provenance.branch ||
    run.head_repository?.full_name !== provenance.headRepository ||
    run.status !== "completed" ||
    run.conclusion !== "success"
  ) {
    fail(`${name} provenance run must be the successful protected workflow for its exact commit`);
  }
  return runId;
}

async function verifyRunArtifactDescriptors(slug, runId, descriptors) {
  const response = await fetchJson(
    `https://api.github.com/repos/${slug}/actions/runs/${runId}/artifacts?per_page=100`,
  );
  if (!Array.isArray(response.artifacts)) fail("Actions artifact inventory is invalid");
  for (const descriptor of descriptors) {
    const matches = response.artifacts.filter(
      (artifact) => artifact.id === descriptor.id || artifact.name === descriptor.name,
    );
    if (
      matches.length !== 1 ||
      matches[0].id !== descriptor.id ||
      matches[0].name !== descriptor.name ||
      matches[0].digest !== descriptor.archiveDigest ||
      matches[0].expired !== false
    ) {
      fail(`Actions artifact metadata does not match ${descriptor.name}`);
    }
  }
}

export function reviewedCleanHistoryMatchesCandidate(proof, component, policy) {
  const history = policy.reviewedHistory;
  const candidate = proof?.candidateGitCommit;
  const cleanAnchor = proof?.cleanAnchorGitCommit;
  const upstreamBase = proof?.upstreamBaseGitCommit;
  const sourcePull = proof?.sourcePull;
  const sourceHead = proof?.sourceHeadGitCommit;
  const finalPull = proof?.finalPull;
  const finalBase = proof?.finalBaseGitCommit;
  const finalMerge = proof?.finalMergeGitCommit;
  const developmentPulls = proof?.developmentPulls;
  const developmentCompares = proof?.developmentCompares;
  const postCleanPulls = proof?.postCleanPulls;
  const postCleanMergeGitCommits = proof?.postCleanMergeGitCommits;
  const candidateTree = candidate?.tree?.sha;
  const cleanAnchorTree = cleanAnchor?.tree?.sha;
  const sourceTree = sourceHead?.tree?.sha;
  const finalBaseTree = finalBase?.tree?.sha;
  const finalTree = finalMerge?.tree?.sha;

  // The source PR is review evidence only: merging it would import the retired development ancestry.
  // The clean anchor reproduces that reviewed tree, then protected PR merges continue from it exactly.
  return Boolean(
    history &&
      component.commit === candidate?.sha &&
      cleanAnchor?.sha === history.cleanAnchor &&
      Array.isArray(cleanAnchor?.parents) &&
      cleanAnchor.parents.length === 1 &&
      cleanAnchor.parents[0]?.sha === history.upstreamBase &&
      upstreamBase?.sha === history.upstreamBase &&
      sourcePull?.number === history.sourceTreePullRequest &&
      sourcePull.merged_at === null &&
      sourcePull.base?.ref === history.sourceBaseBranch &&
      sourcePull.base?.repo?.full_name === policy.slug &&
      sourcePull.head?.repo?.full_name === policy.slug &&
      sourcePull.head?.sha === sourceHead?.sha &&
      finalPull?.number === history.finalTreePullRequest &&
      finalPull.merged_at &&
      finalPull.base?.ref === history.finalBaseBranch &&
      finalPull.base?.repo?.full_name === policy.slug &&
      finalPull.head?.repo?.full_name === policy.slug &&
      finalPull.base?.sha === finalBase?.sha &&
      finalPull.merge_commit_sha === finalMerge?.sha &&
      Array.isArray(finalMerge?.parents) &&
      finalMerge.parents.length === 2 &&
      finalMerge.parents[0]?.sha === finalBase?.sha &&
      finalMerge.parents[1]?.sha === finalPull.head?.sha &&
      /^[0-9a-f]{40}$/.test(candidateTree ?? "") &&
      /^[0-9a-f]{40}$/.test(cleanAnchorTree ?? "") &&
      cleanAnchorTree === finalTree &&
      /^[0-9a-f]{40}$/.test(sourceTree ?? "") &&
      sourceTree === finalBaseTree &&
      Array.isArray(developmentPulls) &&
      Array.isArray(developmentCompares) &&
      developmentPulls.length === history.developmentPullRequests.length &&
      developmentCompares.length === history.developmentPullRequests.length &&
      history.developmentPullRequests.every((number, index) => {
        const pull = developmentPulls[index];
        return Boolean(
          pull?.number === number &&
            pull.merged_at &&
            /^[0-9a-f]{40}$/.test(pull.merge_commit_sha ?? "") &&
            pull.base?.repo?.full_name === policy.slug &&
            pull.head?.repo?.full_name === policy.slug &&
            commitContainsAncestor(developmentCompares[index], pull.merge_commit_sha, sourceHead.sha),
        );
      }) &&
      Array.isArray(postCleanPulls) &&
      Array.isArray(postCleanMergeGitCommits) &&
      postCleanPulls.length === history.postCleanPullRequests.length &&
      postCleanMergeGitCommits.length === history.postCleanPullRequests.length &&
      history.postCleanPullRequests.every((number, index) => {
        const pull = postCleanPulls[index];
        const merge = postCleanMergeGitCommits[index];
        const previousSha = index === 0
          ? cleanAnchor.sha
          : postCleanMergeGitCommits[index - 1]?.sha;
        return Boolean(
          pull?.number === number &&
            pull.merged_at &&
            pull.base?.ref === history.protectedBranch &&
            pull.base?.repo?.full_name === policy.slug &&
            pull.head?.repo?.full_name === policy.slug &&
            pull.base?.sha === previousSha &&
            /^[0-9a-f]{40}$/.test(pull.head?.sha ?? "") &&
            pull.merge_commit_sha === merge?.sha &&
            Array.isArray(merge?.parents) &&
            merge.parents.length === 2 &&
            merge.parents[0]?.sha === previousSha &&
            merge.parents[1]?.sha === pull.head.sha,
        );
      }) &&
      postCleanMergeGitCommits.at(-1)?.sha === candidate.sha,
  );
}

async function missingRequiredPullRequests(component, policy, name) {
  const checks = await Promise.all(policy.requiredPullRequests.map(async (number) => {
    const pull = await fetchJson(`https://api.github.com/repos/${policy.slug}/pulls/${number}`);
    if (!pull.merged_at || !pull.merge_commit_sha) {
      return `${name}#${number}`;
    }
    const compare = await githubCompare(policy.slug, pull.merge_commit_sha, component.commit);
    if (!commitContainsAncestor(compare, pull.merge_commit_sha, component.commit)) {
      return `${name}#${number}`;
    }
    return null;
  }));
  return checks.filter(Boolean);
}

async function reviewedKodiHistoryMissing(component, policy) {
  const history = policy.reviewedHistory;
  const initialProof = await Promise.all([
      fetchJson(`https://api.github.com/repos/${policy.slug}/git/commits/${component.commit}`),
      fetchJson(`https://api.github.com/repos/${policy.slug}/git/commits/${history.cleanAnchor}`),
      fetchJson(
        `https://api.github.com/repos/${KODI_UPSTREAM_REPOSITORY}/git/commits/${history.upstreamBase}`,
      ),
      fetchJson(
        `https://api.github.com/repos/${policy.slug}/pulls/${history.sourceTreePullRequest}`,
      ),
      fetchJson(`https://api.github.com/repos/${policy.slug}/pulls/${history.finalTreePullRequest}`),
      ...history.developmentPullRequests.map((number) =>
        fetchJson(`https://api.github.com/repos/${policy.slug}/pulls/${number}`),
      ),
      ...history.postCleanPullRequests.map((number) =>
        fetchJson(`https://api.github.com/repos/${policy.slug}/pulls/${number}`),
      ),
    ]);
  const candidateGitCommit = initialProof[0];
  const cleanAnchorGitCommit = initialProof[1];
  const upstreamBaseGitCommit = initialProof[2];
  const sourcePull = initialProof[3];
  const finalPull = initialProof[4];
  const developmentStart = 5;
  const postCleanStart = developmentStart + history.developmentPullRequests.length;
  const developmentPulls = initialProof.slice(developmentStart, postCleanStart);
  const postCleanPulls = initialProof.slice(postCleanStart);
  if (
    !/^[0-9a-f]{40}$/.test(sourcePull?.head?.sha ?? "") ||
    !/^[0-9a-f]{40}$/.test(finalPull?.base?.sha ?? "") ||
    !/^[0-9a-f]{40}$/.test(finalPull?.merge_commit_sha ?? "") ||
    postCleanPulls.some((pull) => !/^[0-9a-f]{40}$/.test(pull?.merge_commit_sha ?? ""))
  ) {
    return ["Kodi clean-history review chain"];
  }
  const secondaryProof = await Promise.all([
      fetchJson(`https://api.github.com/repos/${policy.slug}/git/commits/${sourcePull.head.sha}`),
      fetchJson(`https://api.github.com/repos/${policy.slug}/git/commits/${finalPull.base.sha}`),
      fetchJson(
        `https://api.github.com/repos/${policy.slug}/git/commits/${finalPull.merge_commit_sha}`,
      ),
      ...developmentPulls.map((pull) =>
        githubCompare(policy.slug, pull.merge_commit_sha, sourcePull.head.sha),
      ),
      ...postCleanPulls.map((pull) =>
        fetchJson(`https://api.github.com/repos/${policy.slug}/git/commits/${pull.merge_commit_sha}`),
      ),
    ]);
  const sourceHeadGitCommit = secondaryProof[0];
  const finalBaseGitCommit = secondaryProof[1];
  const finalMergeGitCommit = secondaryProof[2];
  const compareStart = 3;
  const postMergeStart = compareStart + developmentPulls.length;
  const developmentCompares = secondaryProof.slice(compareStart, postMergeStart);
  const postCleanMergeGitCommits = secondaryProof.slice(postMergeStart);
  return reviewedCleanHistoryMatchesCandidate(
    {
      candidateGitCommit,
      cleanAnchorGitCommit,
      upstreamBaseGitCommit,
      sourcePull,
      sourceHeadGitCommit,
      finalPull,
      finalBaseGitCommit,
      finalMergeGitCommit,
      developmentPulls,
      developmentCompares,
      postCleanPulls,
      postCleanMergeGitCommits,
    },
    component,
    policy,
  )
    ? []
    : ["Kodi clean-history review chain"];
}

async function verifyPublicCandidate(candidate) {
  const [bridgeMissing, kodiMissing, bridgeRunId, kodiRunId] = await Promise.all([
    missingRequiredPullRequests(candidate.components.bridge, COMPONENT_POLICIES.bridge, "Bridge"),
    reviewedKodiHistoryMissing(candidate.components.kodi, COMPONENT_POLICIES.kodi),
      verifyProvenanceRun(
        candidate.components.bridge,
        COMPONENT_POLICIES.bridge,
        "Bridge",
        candidate.coordinatedVersion,
      ),
      verifyProvenanceRun(
        candidate.components.kodi,
        COMPONENT_POLICIES.kodi,
        "Kodi",
        candidate.coordinatedVersion,
      ),
    verifyComponentCommit(candidate.components.bridge, COMPONENT_POLICIES.bridge, "Bridge"),
    verifyComponentCommit(candidate.components.kodi, COMPONENT_POLICIES.kodi, "Kodi"),
    verifyComponentAuditedFiles(
      candidate.components.bridge,
      COMPONENT_POLICIES.bridge,
      "Bridge",
    ),
    verifyComponentAuditedFiles(candidate.components.kodi, COMPONENT_POLICIES.kodi, "Kodi"),
  ]);
  const bridgeDescriptors = [candidate.components.bridge.provenance.imageArtifact];
  if (candidate.components.bridge.provenance.deploymentAttestationArtifact) {
    bridgeDescriptors.push(candidate.components.bridge.provenance.deploymentAttestationArtifact);
  }
  const kodiDescriptors = Object.values(candidate.components.kodi.artifacts).map((artifact) => ({
    id: artifact.artifactId,
    name: artifact.artifactName,
    archiveDigest: artifact.archiveDigest,
  }));
  await Promise.all([
    verifyRunArtifactDescriptors(COMPONENT_POLICIES.bridge.slug, bridgeRunId, bridgeDescriptors),
    verifyRunArtifactDescriptors(COMPONENT_POLICIES.kodi.slug, kodiRunId, kodiDescriptors),
  ]);
  return { missingPullRequests: [...bridgeMissing, ...kodiMissing] };
}

async function verifyEvidenceArtifacts(evidence, candidate) {
  await Promise.all(
    evidence.runs.map(async (run) => {
      const blob = parseEvidenceBlobUrl(run.evidenceUrl);
      const bytes = await fetchBytes(
        `https://raw.githubusercontent.com/ruizkinio/${blob.repository}/${blob.commit}/${blob.filePath}`,
      );
      const actual = createHash("sha256").update(bytes).digest("hex");
      if (actual !== run.evidenceSha256) {
        fail(`evidence artifact digest does not match ${run.evidenceUrl}`);
      }
      let report;
      try {
        report = JSON.parse(bytes.toString("utf8"));
      } catch {
        fail(`UAT evidence artifact is not JSON: ${run.evidenceUrl}`);
      }
      validateUatReport(report, run, candidate);
    }),
  );
}

function verifyGeneratedSecurityAudit(evidence) {
  for (const report of evidence.repositories) {
    verifyCurrentPublicRefManifest(
      report.refs,
      currentPublicRefManifest(`https://github.com/${report.repository}.git`),
    );
    if (report.repository === "ruizkinio/Jumpgate-kodi") {
      verifyCurrentPublicRefManifest(
        report.upstream.refs,
        currentPublicRefManifest(`https://github.com/${KODI_UPSTREAM_REPOSITORY}.git`),
      );
    }
  }
  return true;
}

async function verifyLiveSecurityState() {
  const [bridgeCode, rootSecrets, bridgeSecrets, kodiSecrets] = await Promise.all([
    fetchJson(
      "https://api.github.com/repos/ruizkinio/Jumpgate-bridge/code-scanning/alerts?state=open&per_page=1",
    ),
    fetchJson(
      "https://api.github.com/repos/ruizkinio/Jumpgate/secret-scanning/alerts?state=open&per_page=1",
    ),
    fetchJson(
      "https://api.github.com/repos/ruizkinio/Jumpgate-bridge/secret-scanning/alerts?state=open&per_page=1",
    ),
    fetchJson(
      "https://api.github.com/repos/ruizkinio/Jumpgate-kodi/secret-scanning/alerts?state=open&per_page=1",
    ),
  ]);
  return [bridgeCode, rootSecrets, bridgeSecrets, kodiSecrets].every(
    (alerts) => Array.isArray(alerts) && alerts.length === 0,
  );
}

function actionsArtifactDownloadUrl(slug, descriptor) {
  return `https://api.github.com/repos/${slug}/actions/artifacts/${descriptor.id}/zip`;
}

async function downloadVerifiedArtifact(slug, descriptor, maximumBytes) {
  const archive = await fetchArtifactBytes(
    actionsArtifactDownloadUrl(slug, descriptor),
    maximumBytes,
  );
  const digest = `sha256:${createHash("sha256").update(archive).digest("hex")}`;
  if (digest !== descriptor.archiveDigest) {
    fail(`downloaded Actions artifact digest does not match ${descriptor.name}`);
  }
  return archive;
}

function findAndroidBuildTool(tool) {
  const roots = [process.env.ANDROID_SDK_ROOT, process.env.ANDROID_HOME];
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    roots.push(resolve(process.env.LOCALAPPDATA, "Android", "Sdk"));
  }
  const suffix = process.platform === "win32" ? (tool === "apksigner" ? ".bat" : ".exe") : "";
  for (const sdk of [...new Set(roots.filter(Boolean))]) {
    const candidate = resolve(sdk, "build-tools", "36.0.0", `${tool}${suffix}`);
    if (existsSync(candidate)) return candidate;
  }
  fail(`Android build-tools 36.0.0 ${tool} is unavailable`);
}

function runAndroidBuildTool(executable, args) {
  const options = { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 };
  if (process.platform === "win32" && executable.toLowerCase().endsWith(".bat")) {
    return execFileSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", executable, ...args], options);
  }
  return execFileSync(executable, args, options);
}

export function parseAapt2Badging(output) {
  if (typeof output !== "string") fail("aapt2 badging output must be text");
  const packageLines = output.split(/\r?\n/).filter((line) => line.startsWith("package: "));
  if (packageLines.length !== 1) fail("aapt2 badging output must contain one package record");
  const fields = new Map();
  for (const match of packageLines[0].matchAll(/\b(name|versionCode|versionName)='([^'\r\n]*)'/g)) {
    if (fields.has(match[1])) fail(`aapt2 package record duplicates ${match[1]}`);
    fields.set(match[1], match[2]);
  }
  const applicationId = fields.get("name");
  const versionCodeText = fields.get("versionCode");
  const versionName = fields.get("versionName");
  if (
    !/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(applicationId ?? "") ||
    !/^[1-9][0-9]*$/.test(versionCodeText ?? "") ||
    typeof versionName !== "string" ||
    versionName.length < 1 ||
    versionName.length > 128 ||
    /[\u0000-\u001f\u007f]/.test(versionName)
  ) {
    fail("aapt2 package record is missing valid package/version metadata");
  }
  const versionCode = Number(versionCodeText);
  if (!Number.isSafeInteger(versionCode)) fail("aapt2 versionCode exceeds the safe integer range");
  return { applicationId, versionCode, versionName };
}

export function validateKodiApkManifest(manifest, policy = KODI_RELEASE_POLICY) {
  assertExactValue(manifest, policy.apkManifest, "Kodi APK manifest");
  return manifest;
}

export function validateStremioApkManifest(manifest, stremio, app, artifact) {
  assertExactValue(
    manifest,
    {
      applicationId: stremio.packageName,
      versionCode: artifact.versionCode,
      versionName: app.versionName,
    },
    "Stremio APK manifest",
  );
  return manifest;
}

export function parseApkSignerCertificate(output) {
  if (typeof output !== "string") fail("apksigner output must be text");
  const fingerprints = [
    ...output.matchAll(/Signer #[0-9]+ certificate SHA-256 digest:\s*([0-9a-f]{64})/gi),
  ].map((match) => match[1].toLowerCase());
  if (fingerprints.length !== 1) {
    fail("APK must contain exactly one signing certificate");
  }
  return fingerprints[0];
}

async function verifyKodiReleaseArtifacts(candidate, policy = KODI_RELEASE_POLICY) {
  const releaseSignerProvisioned = releaseSignerIsProvisioned(policy.signer);
  const aapt2 = findAndroidBuildTool("aapt2");
  const apksigner = findAndroidBuildTool("apksigner");
  const temp = mkdtempSync(resolve(tmpdir(), "jumpgate-apk-proof-"));
  try {
    for (const abi of ["arm64-v8a", "armeabi-v7a"]) {
      const artifact = candidate.components.kodi.artifacts[abi];
      const descriptor = {
        id: artifact.artifactId,
        name: artifact.artifactName,
        archiveDigest: artifact.archiveDigest,
      };
      const archive = await downloadVerifiedArtifact(
        COMPONENT_POLICIES.kodi.slug,
        descriptor,
        200 * 1024 * 1024,
      );
      const entries = parseZipEntries(archive);
      const apkNames = [...entries.keys()].filter((name) => name.endsWith(".apk"));
      if (apkNames.length !== 1) fail(`${abi} Actions artifact must contain exactly one APK`);
      const apk = extractZipEntry(archive, entries, apkNames[0], 200 * 1024 * 1024);
      if (createHash("sha256").update(apk).digest("hex") !== artifact.apkSha256) {
        fail(`${abi} APK bytes do not match the locked SHA-256`);
      }
      validateApkNativeAbi(apk, abi, `${abi} Jumpgate APK`);
      const apkPath = resolve(temp, `${abi}.apk`);
      writeFileSync(apkPath, apk);
      const badging = runAndroidBuildTool(aapt2, ["dump", "badging", apkPath]);
      validateKodiApkManifest(parseAapt2Badging(badging), policy);
      const signerOutput = runAndroidBuildTool(apksigner, ["verify", "--print-certs", apkPath]);
      const signer = parseApkSignerCertificate(signerOutput);
      if (releaseSignerProvisioned && signer !== policy.signer.certificateSha256) {
        fail(`${abi} APK signer does not match the locked release certificate`);
      }
    }
    return releaseSignerProvisioned;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

export async function verifyStremioReleaseArtifacts(candidate) {
  const aapt2 = findAndroidBuildTool("aapt2");
  const apksigner = findAndroidBuildTool("apksigner");
  const temp = mkdtempSync(resolve(tmpdir(), "jumpgate-stremio-apk-proof-"));
  try {
    for (const [appName, app] of Object.entries(candidate.stremio.apps)) {
      for (const abi of STREMIO_RELEASE_POLICY.abis) {
        const artifact = app.artifacts[abi];
        const apk = await fetchBoundedBytes(artifact.downloadUrl, 200 * 1024 * 1024);
        if (createHash("sha256").update(apk).digest("hex") !== artifact.apkSha256) {
          fail(`${appName} ${abi} Stremio APK bytes do not match the locked SHA-256`);
        }
        validateApkNativeAbi(apk, abi, `${appName} ${abi} Stremio APK`);
        const apkPath = resolve(temp, `${appName}-${abi}.apk`);
        writeFileSync(apkPath, apk, { flag: "wx", mode: 0o600 });
        const badging = runAndroidBuildTool(aapt2, ["dump", "badging", apkPath]);
        validateStremioApkManifest(
          parseAapt2Badging(badging),
          candidate.stremio,
          app,
          artifact,
        );
        const signerOutput = runAndroidBuildTool(apksigner, ["verify", "--print-certs", apkPath]);
        if (parseApkSignerCertificate(signerOutput) !== candidate.stremio.signerCertificateSha256) {
          fail(`${appName} ${abi} Stremio APK signer does not match the policy-locked certificate`);
        }
      }
    }
    return true;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

export function validateBridgeDeploymentAttestation(
  attestation,
  candidate,
  flyConfigSha256,
) {
  assertExactKeys(
    attestation,
    [
      "schemaVersion",
      "bridgeCommit",
      "imageDigest",
      "workflowRunId",
      "workflowId",
      "application",
      "releaseId",
      "machineIds",
      "managedIntervals",
      "writerProtocol",
      "flyConfigSha256",
      "verifiedAt",
      "status",
    ],
    "Bridge deployment attestation",
  );
  const machineIds = attestation.machineIds;
  if (
    attestation.schemaVersion !== 2 ||
    attestation.bridgeCommit !== candidate.components.bridge.commit ||
    attestation.imageDigest !== candidate.components.bridge.imageDigest ||
    String(attestation.workflowRunId) !==
      parseGithubActionsRunUrl(
        candidate.components.bridge.provenance.runUrl,
        COMPONENT_POLICIES.bridge.slug,
      ) ||
    attestation.workflowId !== COMPONENT_POLICIES.bridge.workflowId ||
    attestation.application !== "jumpgate-bridge" ||
    !/^rel_[a-z0-9]{10,64}$/.test(attestation.releaseId) ||
    !Array.isArray(machineIds) ||
    machineIds.length !== 2 ||
    new Set(machineIds).size !== 2 ||
    machineIds.some((machineId) => !/^[a-f0-9]{14}$/.test(machineId)) ||
    machineIds.join("\n") !== [...machineIds].sort().join("\n") ||
    !Number.isSafeInteger(attestation.managedIntervals) ||
    attestation.managedIntervals < 3 ||
    attestation.managedIntervals > 12 ||
    attestation.writerProtocol !== "v6" ||
    attestation.flyConfigSha256 !== flyConfigSha256 ||
    !/^[a-f0-9]{64}$/.test(attestation.flyConfigSha256) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(attestation.verifiedAt) ||
    !Number.isFinite(Date.parse(attestation.verifiedAt)) ||
    attestation.status !== "deployed-and-smoke-tested"
  ) {
    fail("Bridge deployment attestation does not match the locked production candidate");
  }
  return attestation;
}

export function verifyGithubDeploymentAttestation(
  subjectPath,
  subjectBytes,
  candidate,
  execute = execFileSync,
) {
  if (!process.env.GITHUB_TOKEN) {
    fail("GITHUB_TOKEN is required to verify GitHub deployment provenance");
  }
  const expectedDigest = createHash("sha256").update(subjectBytes).digest("hex");
  let output;
  try {
    output = execute(
      "gh",
      [
        "attestation",
        "verify",
        subjectPath,
        "--repo",
        COMPONENT_POLICIES.bridge.slug,
        "--signer-workflow",
        `${COMPONENT_POLICIES.bridge.slug}/${COMPONENT_POLICIES.bridge.workflowPath}`,
        "--source-digest",
        candidate.components.bridge.commit,
        "--source-ref",
        `refs/heads/${COMPONENT_POLICIES.bridge.branch}`,
        "--deny-self-hosted-runners",
        "--limit",
        "1",
        "--format",
        "json",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN },
        maxBuffer: 16 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch {
    fail("GitHub deployment provenance verification failed");
  }
  let records;
  try {
    records = JSON.parse(output);
  } catch {
    fail("GitHub deployment provenance verification output is invalid");
  }
  const subjects = records?.[0]?.verificationResult?.statement?.subject;
  if (
    !Array.isArray(records) ||
    records.length !== 1 ||
    !Array.isArray(subjects) ||
    subjects.length !== 1 ||
    subjects[0]?.digest?.sha256 !== expectedDigest
  ) {
    fail("GitHub deployment provenance does not bind the canonical attestation bytes");
  }
  return true;
}

export async function verifyLiveBridgeState(
  candidate,
  loadJson = fetchJson,
  loadText = fetchText,
) {
  const [version, readiness] = await Promise.all([
    loadJson("https://jumpgate-bridge.fly.dev/version"),
    loadText("https://jumpgate-bridge.fly.dev/health/ready"),
  ]);
  const [major, minor, patch] = candidate.coordinatedVersion
    .split("-", 1)[0]
    .split(".")
    .map(Number);
  if (
    !isPlainObject(version) ||
    version.version !== candidate.coordinatedVersion ||
    version.major !== major ||
    version.minor !== minor ||
    version.patch !== patch ||
    version.buildSha !== candidate.components.bridge.commit ||
    readiness !== '{"ok":true,"status":"ready"}'
  ) {
    fail("live Bridge version or readiness does not match the locked production candidate");
  }
  return true;
}

async function verifyBridgeDeploymentAttestation(candidate) {
  const descriptor = candidate.components.bridge.provenance.deploymentAttestationArtifact;
  if (!descriptor) return false;
  const archive = await downloadVerifiedArtifact(
    COMPONENT_POLICIES.bridge.slug,
    descriptor,
    10 * 1024 * 1024,
  );
  const entries = parseZipEntries(archive);
  if (entries.size !== 1 || !entries.has("deployment-attestation.json")) {
    fail("Bridge deployment attestation artifact must contain one canonical JSON file");
  }
  let attestation;
  let subjectBytes;
  try {
    subjectBytes = extractZipEntry(archive, entries, "deployment-attestation.json", 64 * 1024);
    attestation = JSON.parse(subjectBytes.toString("utf8"));
  } catch {
    fail("Bridge deployment attestation JSON is invalid");
  }
  const flyConfigBytes = await fetchBytes(
    `https://raw.githubusercontent.com/${COMPONENT_POLICIES.bridge.slug}/` +
      `${candidate.components.bridge.commit}/fly.toml`,
  );
  const flyConfigSha256 = createHash("sha256").update(flyConfigBytes).digest("hex");
  validateBridgeDeploymentAttestation(
    attestation,
    candidate,
    flyConfigSha256,
  );
  const temp = mkdtempSync(resolve(tmpdir(), "jumpgate-bridge-attestation-"));
  try {
    const subjectPath = resolve(temp, "deployment-attestation.json");
    writeFileSync(subjectPath, subjectBytes, { flag: "wx", mode: 0o600 });
    verifyGithubDeploymentAttestation(subjectPath, subjectBytes, candidate);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  return verifyLiveBridgeState(candidate);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`cannot read valid JSON from ${path}: ${error.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const requireReady = args.length === 1 && args[0] === "--require-ready";
  if (args.length && !requireReady) {
    fail("usage: node release/validate-release.mjs [--require-ready]");
  }
  if (
    requireReady &&
    process.env.GITHUB_ACTIONS === "true" &&
    process.env.GITHUB_REF !== "refs/heads/main"
  ) {
    fail("release readiness may run only against refs/heads/main");
  }

  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const candidate = validateCandidate(readJson(resolve(root, "release/candidate.json")));
  validateGitlinks(candidate, readGitlinks(root));
  const publicProof = await verifyPublicCandidate(candidate);

  const physicalEvidencePath = resolve(root, candidate.physicalUatEvidence);
  if (!physicalEvidencePath.startsWith(`${root}${sep}`)) {
    fail("physicalUatEvidence must stay inside the repository");
  }
  let physicalEvidence = null;
  if (existsSync(physicalEvidencePath)) {
    physicalEvidence = validateEvidence(readJson(physicalEvidencePath), candidate);
    await verifyEvidenceArtifacts(physicalEvidence, candidate);
  }

  const securityAuditPath = resolve(root, candidate.securityAuditEvidence);
  if (!securityAuditPath.startsWith(`${root}${sep}`)) {
    fail("securityAuditEvidence must stay inside the repository");
  }
  const securityAllowlistPath = resolve(root, "release/security-allowlist.json");
  const securityAllowlistBytes = readFileSync(securityAllowlistPath);
  const securityAllowlist = readJson(securityAllowlistPath);
  const securityAllowlistSha256 = createHash("sha256")
    .update(securityAllowlistBytes)
    .digest("hex");
  let securityAudit = null;
  if (existsSync(securityAuditPath)) {
    if (pathIsTracked(root, candidate.securityAuditEvidence)) {
      fail("security audit evidence must be generated and untracked");
    }
    securityAudit = validateSecurityAudit(
      readJson(securityAuditPath),
      candidate,
      new Date(),
      securityAllowlist,
      securityAllowlistSha256,
    );
    verifyGeneratedSecurityAudit(securityAudit);
  }

  const [kodiArtifactProof, stremioArtifactProof, bridgeAttestationProof, liveSecurityProof] = requireReady
    ? await Promise.all([
        verifyKodiReleaseArtifacts(candidate),
        verifyStremioReleaseArtifacts(candidate),
        verifyBridgeDeploymentAttestation(candidate),
        securityAudit ? verifyLiveSecurityState() : false,
      ])
    : [false, false, false, false];

  const blockers = readinessBlockers({
    ...publicProof,
    physicalEvidence,
    securityAudit,
    liveSecurityProof,
    kodiArtifactProof,
    stremioArtifactProof,
    bridgeAttestationProof,
  });
  if (requireReady && blockers.length) {
    fail(`release readiness refused:\n- ${blockers.join("\n- ")}`);
  }

  console.log(`Validated locked Jumpgate ${candidate.coordinatedVersion} candidate metadata.`);
  console.log(
    "Validated gitlinks, public component reachability, audited workflow bytes, PR proofs, protected runs, and artifact identities.",
  );
  console.log("Validated the pinned native Stremio Android Mobile and TV baselines.");
  if (blockers.length) {
    console.log(`Release readiness remains blocked:\n- ${blockers.join("\n- ")}`);
  } else {
    console.log("Release readiness proof is complete.");
  }
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
