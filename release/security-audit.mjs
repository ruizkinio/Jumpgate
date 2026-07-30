#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import {
  GITLEAKS_POLICY,
  KODI_UPSTREAM_REPOSITORY,
  SECURITY_SCOPES,
  publicRefManifestSha256,
  validateSecurityAudit,
} from "./validate-release.mjs";

export const GITLEAKS_CONFIG =
  'title = "Jumpgate pinned Gitleaks default rules"\n\n[extend]\nuseDefault = true\n';

const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_TAR_BYTES = 64 * 1024 * 1024;
const MAX_REPORT_BYTES = 64 * 1024 * 1024;
const MAX_FINDINGS = 100_000;
const MAX_CHILD_OUTPUT = 16 * 1024 * 1024;
const DOWNLOAD_HOSTS = new Set(["github.com", "release-assets.githubusercontent.com"]);
const REPOSITORIES = Object.freeze([
  Object.freeze({ slug: "ruizkinio/Jumpgate", remote: "https://github.com/ruizkinio/Jumpgate.git" }),
  Object.freeze({
    slug: "ruizkinio/Jumpgate-bridge",
    remote: "https://github.com/ruizkinio/Jumpgate-bridge.git",
  }),
  Object.freeze({
    slug: "ruizkinio/Jumpgate-kodi",
    remote: "https://github.com/ruizkinio/Jumpgate-kodi.git",
  }),
]);
const KODI_UPSTREAM_REMOTE = `https://github.com/${KODI_UPSTREAM_REPOSITORY}.git`;

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseJson(bytes, path) {
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch (error) {
    fail(`${path} is not valid JSON: ${error.message}`);
  }
}

export function environmentContaminants(env = process.env) {
  const exact = new Set([
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_ASKPASS",
    "GIT_COMMON_DIR",
    "GIT_CONFIG",
    "GIT_CONFIG_COUNT",
    "GIT_CONFIG_GLOBAL",
    "GIT_CONFIG_NOSYSTEM",
    "GIT_DIR",
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_SSH",
    "GIT_SSH_COMMAND",
    "GIT_WORK_TREE",
  ]);
  return Object.keys(env)
    .filter(
      (name) =>
        exact.has(name) ||
        name.startsWith("GIT_CONFIG_KEY_") ||
        name.startsWith("GIT_CONFIG_VALUE_") ||
        name.startsWith("GITLEAKS_"),
    )
    .sort();
}

function sterileEnvironment(home) {
  return {
    HOME: home,
    LANG: "C",
    LC_ALL: "C",
    PATH: process.env.PATH,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
  };
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    input: options.input,
    encoding: "utf8",
    maxBuffer: options.maxBuffer ?? MAX_CHILD_OUTPUT,
    windowsHide: true,
  });
  if (result.error) {
    fail(`${options.label ?? command} could not execute: ${result.error.message}`);
  }
  const accepted = options.acceptedStatuses ?? [0];
  if (!accepted.includes(result.status)) {
    fail(`${options.label ?? command} failed with exit status ${result.status ?? "unknown"}`);
  }
  return result;
}

function runGit(args, options) {
  return runCommand(
    "git",
    [
      "-c",
      "credential.helper=",
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "protocol.file.allow=never",
      "-c",
      "protocol.ext.allow=never",
      ...args,
    ],
    { ...options, label: options.label ?? "isolated git command" },
  );
}

async function readBoundedResponse(response, maximumBytes) {
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maximumBytes)) {
    fail("pinned scanner archive exceeds the download limit");
  }
  if (!response.body) fail("pinned scanner archive response has no body");
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    const bytes = Buffer.from(chunk);
    length += bytes.length;
    if (length > maximumBytes) fail("pinned scanner archive exceeds the download limit");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, length);
}

export async function downloadPinnedArchive(fetchImpl = fetch) {
  let url = new URL(GITLEAKS_POLICY.linuxX64ArchiveUrl);
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    if (url.protocol !== "https:" || !DOWNLOAD_HOSTS.has(url.hostname)) {
      fail("pinned scanner download left the approved HTTPS hosts");
    }
    const response = await fetchImpl(url, {
      redirect: "manual",
      headers: { "User-Agent": "Jumpgate-release-security-audit" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === 5) fail("pinned scanner download redirect is invalid");
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) fail(`pinned scanner download failed with HTTP ${response.status}`);
    const archive = await readBoundedResponse(response, MAX_ARCHIVE_BYTES);
    if (sha256(archive) !== GITLEAKS_POLICY.linuxX64ArchiveSha256) {
      fail("pinned scanner archive SHA-256 does not match policy");
    }
    return archive;
  }
  fail("pinned scanner download exceeded the redirect limit");
}

function tarString(block, offset, length) {
  const end = block.indexOf(0, offset);
  const stop = end === -1 || end > offset + length ? offset + length : end;
  return block.subarray(offset, stop).toString("utf8");
}

function tarOctal(block, offset, length, field) {
  const value = tarString(block, offset, length).trim();
  if (!/^[0-7]+$/.test(value)) fail(`pinned scanner tar ${field} is invalid`);
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0) fail(`pinned scanner tar ${field} is invalid`);
  return parsed;
}

function verifyTarChecksum(block) {
  const expected = tarOctal(block, 148, 8, "checksum");
  let actual = 0;
  for (let index = 0; index < block.length; index += 1) {
    actual += index >= 148 && index < 156 ? 0x20 : block[index];
  }
  if (actual !== expected) fail("pinned scanner tar checksum is invalid");
}

export function extractPinnedGitleaks(archive) {
  let tar;
  try {
    tar = gunzipSync(archive, { maxOutputLength: MAX_TAR_BYTES });
  } catch (error) {
    fail(`pinned scanner archive is not a bounded gzip stream: ${error.message}`);
  }
  const expectedEntries = new Set(["LICENSE", "README.md", "gitleaks"]);
  const seen = new Set();
  let executable = null;
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    verifyTarChecksum(header);
    const name = tarString(header, 0, 100);
    const prefix = tarString(header, 345, 155);
    const path = prefix ? `${prefix}/${name}` : name;
    const size = tarOctal(header, 124, 12, "entry size");
    const type = header[156];
    if (!expectedEntries.has(path) || seen.has(path) || (type !== 0 && type !== 0x30)) {
      fail("pinned scanner tar contains an unexpected entry");
    }
    const bodyStart = offset + 512;
    const bodyEnd = bodyStart + size;
    if (bodyEnd > tar.length) fail("pinned scanner tar entry is truncated");
    if (path === "gitleaks") executable = Buffer.from(tar.subarray(bodyStart, bodyEnd));
    seen.add(path);
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
  if (seen.size !== expectedEntries.size || [...expectedEntries].some((entry) => !seen.has(entry))) {
    fail("pinned scanner tar is missing an expected entry");
  }
  if (!executable || executable.length < 1024 * 1024 || executable.length > 32 * 1024 * 1024) {
    fail("pinned scanner executable has an invalid size");
  }
  return executable;
}

function installScanner(archive, directory, env) {
  const scannerPath = resolve(directory, "gitleaks");
  writeFileSync(scannerPath, extractPinnedGitleaks(archive), { flag: "wx", mode: 0o700 });
  chmodSync(scannerPath, 0o700);
  const result = runCommand(scannerPath, ["version"], {
    env,
    label: "policy-pinned Gitleaks version check",
  });
  if (result.stdout.trim() !== GITLEAKS_POLICY.version || result.stderr.trim() !== "") {
    fail("policy-pinned Gitleaks executable reports an unexpected version");
  }
  return scannerPath;
}

export function parsePublicRefManifest(output) {
  if (typeof output !== "string" || output.length > 8 * 1024 * 1024) {
    fail("public ref manifest output is invalid");
  }
  const refs = output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const match = /^([0-9a-f]{40})\t(.+)$/.exec(line);
      if (!match) fail("public ref manifest contains an invalid record");
      return { name: match[2], objectId: match[1] };
    })
    .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  publicRefManifestSha256(refs);
  return refs;
}

function capturePublicRefs(remote, env) {
  const result = runGit(["ls-remote", "--heads", "--tags", remote], {
    env,
    label: "public ref capture",
  });
  return parsePublicRefManifest(result.stdout);
}

function assertSameManifest(expected, actual, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} changed during the security audit`);
  }
}

function privateRef(namespace, index) {
  return `refs/jumpgate-audit/${namespace}/${String(index).padStart(6, "0")}`;
}

function fetchManifest(repositoryPath, remoteName, namespace, manifest, env) {
  const baseRefs = manifest.filter((entry) => !entry.name.endsWith("^{}"));
  const refspecs = baseRefs.map(
    (entry, index) => `+${entry.name}:${privateRef(namespace, index)}`,
  );
  runGit(
    [
      "fetch",
      "--quiet",
      "--filter=blob:none",
      "--no-tags",
      "--no-write-fetch-head",
      remoteName,
      "--stdin",
    ],
    {
      cwd: repositoryPath,
      env,
      input: `${refspecs.join("\n")}\n`,
      label: `fetch ${namespace} refs into the private audit namespace`,
    },
  );
  for (const [index, entry] of baseRefs.entries()) {
    const destination = privateRef(namespace, index);
    const objectId = runGit(["rev-parse", destination], {
      cwd: repositoryPath,
      env,
      label: "fetched ref verification",
    }).stdout.trim();
    if (objectId !== entry.objectId) fail("fetched ref object does not match the captured manifest");
    const peeled = manifest.find((candidate) => candidate.name === `${entry.name}^{}`);
    if (peeled) {
      const peeledObjectId = runGit(["rev-parse", `${destination}^{}`], {
        cwd: repositoryPath,
        env,
        label: "fetched annotated tag verification",
      }).stdout.trim();
      if (peeledObjectId !== peeled.objectId) {
        fail("fetched annotated tag does not match the captured manifest");
      }
    }
  }
}

export function normalizeFindingPath(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 4096) {
    fail("Gitleaks finding path is invalid");
  }
  let path = value.replaceAll("\\", "/");
  while (path.startsWith("./")) path = path.slice(2);
  const segments = path.split("/");
  if (
    path.startsWith("/") ||
    /^[A-Za-z]:\//.test(path) ||
    segments.some((segment) => !segment || segment === "." || segment === "..") ||
    /[\u0000-\u001f\u007f]/.test(path)
  ) {
    fail("Gitleaks finding path is not repository-relative");
  }
  return path;
}

function findingInteger(value, field, minimum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > 1_000_000_000) {
    fail(`Gitleaks finding ${field} is invalid`);
  }
  return value;
}

export function findingFingerprint(finding) {
  if (!finding || typeof finding !== "object" || Array.isArray(finding)) {
    fail("Gitleaks finding must be an object");
  }
  if (
    typeof finding.RuleID !== "string" ||
    finding.RuleID.length < 1 ||
    finding.RuleID.length > 200 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:+/-]*$/.test(finding.RuleID)
  ) {
    fail("Gitleaks finding RuleID is invalid");
  }
  if (typeof finding.Commit !== "string" || !/^[0-9a-f]{40}$/i.test(finding.Commit)) {
    fail("Gitleaks finding Commit is invalid");
  }
  const location = {
    rule: finding.RuleID,
    commit: finding.Commit.toLowerCase(),
    path: normalizeFindingPath(finding.File),
    startLine: findingInteger(finding.StartLine, "StartLine", 1),
    endLine: findingInteger(finding.EndLine, "EndLine", 1),
    startColumn: findingInteger(finding.StartColumn, "StartColumn", 0),
    endColumn: findingInteger(finding.EndColumn, "EndColumn", 0),
  };
  if (location.endLine < location.startLine) fail("Gitleaks finding line range is invalid");
  return sha256(Buffer.from(JSON.stringify(location), "utf8"));
}

export function sanitizeFindings(findings) {
  if (!Array.isArray(findings) || findings.length > MAX_FINDINGS) {
    fail("Gitleaks report must be a bounded array");
  }
  return [...new Set(findings.map(findingFingerprint))].sort();
}

function readBoundedFile(path, maximumBytes) {
  const bytes = readFileSync(path);
  if (bytes.length > maximumBytes) fail(`${path} exceeds its size limit`);
  return bytes;
}

function scanRepository(scannerPath, configPath, ignorePath, repositoryPath, logOptions, env) {
  const rawReportPath = resolve(dirname(repositoryPath), `${Date.now()}-${process.pid}-raw.json`);
  const result = runCommand(
    scannerPath,
    [
      "git",
      "--config",
      configPath,
      "--gitleaks-ignore-path",
      ignorePath,
      "--ignore-gitleaks-allow",
      "--report-format",
      "json",
      "--report-path",
      rawReportPath,
      "--redact=100",
      "--no-banner",
      "--no-color",
      "--timeout",
      "1200",
      `--log-opts=${logOptions}`,
      ".",
    ],
    {
      cwd: repositoryPath,
      env,
      acceptedStatuses: [0, 1],
      label: "policy-pinned Gitleaks scan",
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  try {
    if (!existsSync(rawReportPath)) {
      if (result.status === 0) return [];
      fail("Gitleaks reported findings without producing its private JSON report");
    }
    return sanitizeFindings(parseJson(readBoundedFile(rawReportPath, MAX_REPORT_BYTES), "Gitleaks report"));
  } finally {
    rmSync(rawReportPath, { force: true });
  }
}

function reviewedRanges(refs, upstreamHash) {
  return refs
    .filter((entry) => !entry.name.endsWith("^{}"))
    .map((entry) => ({
      ref: entry.name,
      tip: entry.objectId,
      selection: upstreamHash === null ? "reachable-history" : "tip-minus-upstream-public-history",
      excludedRefsSha256: upstreamHash,
    }));
}

function reportCommands(repository) {
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

function scanRemote(repository, replicaRoot, scannerPath, configPath, ignorePath, allowlist, env) {
  const repositoryPath = resolve(replicaRoot, repository.slug.replaceAll("/", "-"));
  const before = capturePublicRefs(repository.remote, env);
  runGit(["init", "--quiet", "--bare", repositoryPath], {
    env,
    label: "initialize isolated audit repository",
  });
  runGit(["config", "remote.public.url", repository.remote], {
    cwd: repositoryPath,
    env,
    label: "configure exact public audit remote",
  });
  runGit(["config", "extensions.partialClone", "public"], {
    cwd: repositoryPath,
    env,
    label: "enable the controlled partial-clone object boundary",
  });
  runGit(["config", "remote.public.promisor", "true"], {
    cwd: repositoryPath,
    env,
    label: "configure the public remote as a controlled promisor",
  });
  runGit(["config", "remote.public.partialclonefilter", "blob:none"], {
    cwd: repositoryPath,
    env,
    label: "configure the public remote blob filter",
  });
  fetchManifest(repositoryPath, "public", "public", before, env);
  const during = capturePublicRefs(repository.remote, env);
  assertSameManifest(before, during, `${repository.slug} public refs`);

  let upstream = null;
  let upstreamBefore = null;
  if (repository.slug === "ruizkinio/Jumpgate-kodi") {
    upstreamBefore = capturePublicRefs(KODI_UPSTREAM_REMOTE, env);
    runGit(["config", "remote.upstream.url", KODI_UPSTREAM_REMOTE], {
      cwd: repositoryPath,
      env,
      label: "configure exact Kodi upstream audit remote",
    });
    runGit(["config", "remote.upstream.promisor", "true"], {
      cwd: repositoryPath,
      env,
      label: "configure the official Kodi remote as a controlled promisor",
    });
    runGit(["config", "remote.upstream.partialclonefilter", "blob:none"], {
      cwd: repositoryPath,
      env,
      label: "configure the official Kodi remote blob filter",
    });
    fetchManifest(repositoryPath, "upstream", "upstream", upstreamBefore, env);
    const upstreamDuring = capturePublicRefs(KODI_UPSTREAM_REMOTE, env);
    assertSameManifest(upstreamBefore, upstreamDuring, "Kodi upstream public refs");
    upstream = {
      repository: KODI_UPSTREAM_REPOSITORY,
      refs: upstreamBefore,
      auditedRefsSha256: publicRefManifestSha256(upstreamBefore),
    };
  }

  const logOptions = upstream
    ? "--full-history --diff-filter=tuxdb --all --not --glob=refs/jumpgate-audit/upstream/*"
    : "--full-history --diff-filter=tuxdb --all";
  const rawFindingFingerprints = scanRepository(
    scannerPath,
    configPath,
    ignorePath,
    repositoryPath,
    logOptions,
    env,
  );
  assertSameManifest(before, capturePublicRefs(repository.remote, env), `${repository.slug} public refs`);
  if (upstreamBefore) {
    assertSameManifest(
      upstreamBefore,
      capturePublicRefs(KODI_UPSTREAM_REMOTE, env),
      "Kodi upstream public refs",
    );
  }

  const allowed = allowlist.entries
    .filter((entry) => entry.repository === repository.slug)
    .map((entry) => entry.fingerprint);
  const allowedSet = new Set(allowed);
  const unresolved = rawFindingFingerprints.filter((fingerprint) => !allowedSet.has(fingerprint));
  const upstreamHash = upstream?.auditedRefsSha256 ?? null;
  return {
    repository: repository.slug,
    scope: SECURITY_SCOPES[repository.slug],
    refs: before,
    auditedRefsSha256: publicRefManifestSha256(before),
    upstream,
    reviewedRanges: reviewedRanges(before, upstreamHash),
    rawFindingFingerprints,
    allowlistedFindingFingerprints: allowed,
    unresolvedFindingFingerprints: unresolved,
    commands: reportCommands(repository.slug),
  };
}

function generateReplica({ root, archive, completedAt, candidate, allowlist, allowlistSha256 }) {
  const replicaRoot = mkdtempSync(resolve(root, "replica-"));
  const home = resolve(replicaRoot, "home");
  const ignorePath = resolve(replicaRoot, "controlled-empty-ignore");
  mkdirSync(home, { mode: 0o700 });
  mkdirSync(ignorePath, { mode: 0o700 });
  const env = sterileEnvironment(home);
  const scannerPath = installScanner(archive, replicaRoot, env);
  const configPath = resolve(replicaRoot, "gitleaks.toml");
  writeFileSync(configPath, GITLEAKS_CONFIG, { flag: "wx", mode: 0o600 });
  if (sha256(Buffer.from(GITLEAKS_CONFIG, "utf8")) !== GITLEAKS_POLICY.configSha256) {
    fail("pinned Gitleaks configuration bytes do not match policy");
  }

  const repositories = REPOSITORIES.map((repository) =>
    scanRemote(repository, replicaRoot, scannerPath, configPath, ignorePath, allowlist, env),
  );
  return {
    schemaVersion: 3,
    candidate: {
      bridgeCommit: candidate.components.bridge.commit,
      kodiCommit: candidate.components.kodi.commit,
    },
    completedAt,
    scanner: {
      name: GITLEAKS_POLICY.scanner,
      version: GITLEAKS_POLICY.version,
      archiveSha256: GITLEAKS_POLICY.linuxX64ArchiveSha256,
      configSha256: GITLEAKS_POLICY.configSha256,
    },
    allowlistSha256,
    repositories,
  };
}

function canonicalBytes(report) {
  return Buffer.from(`${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function readPolicyJson(path) {
  const bytes = readBoundedFile(path, 1024 * 1024);
  return { bytes, value: parseJson(bytes, path) };
}

function parseArguments(args) {
  if (args.length !== 2 || args[0] !== "--output" || !args[1]) {
    fail("usage: node release/security-audit.mjs --output release/evidence/security-audit.json");
  }
  return args[1];
}

async function runScannerSelfTest() {
  const archive = await downloadPinnedArchive();
  const testRoot = mkdtempSync(resolve(tmpdir(), "jumpgate-security-smoke-"));
  try {
    const home = resolve(testRoot, "home");
    const ignorePath = resolve(testRoot, "controlled-empty-ignore");
    const repositoryPath = resolve(testRoot, "synthetic.git");
    mkdirSync(home, { mode: 0o700 });
    mkdirSync(ignorePath, { mode: 0o700 });
    const env = sterileEnvironment(home);
    const scannerPath = installScanner(archive, testRoot, env);
    const configPath = resolve(testRoot, "gitleaks.toml");
    writeFileSync(configPath, GITLEAKS_CONFIG, { flag: "wx", mode: 0o600 });
    runGit(["init", "--quiet", "--bare", repositoryPath], {
      env,
      label: "initialize synthetic security audit repository",
    });
    const syntheticCredential = ["AKIA", "LALE", "MEL3", "3243", "OLIB"].join("");
    const blob = runGit(["hash-object", "-w", "--stdin"], {
      cwd: repositoryPath,
      env,
      input: `generated_test_value=${syntheticCredential}\n`,
      label: "create private synthetic audit blob",
    }).stdout.trim();
    const tree = runGit(["mktree"], {
      cwd: repositoryPath,
      env,
      input: `100644 blob ${blob}\tfixture.txt\n`,
      label: "create private synthetic audit tree",
    }).stdout.trim();
    const commitEnv = {
      ...env,
      GIT_AUTHOR_NAME: "Jumpgate Audit",
      GIT_AUTHOR_EMAIL: "audit@example.invalid",
      GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
      GIT_COMMITTER_NAME: "Jumpgate Audit",
      GIT_COMMITTER_EMAIL: "audit@example.invalid",
      GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
    };
    const commit = runGit(["commit-tree", tree], {
      cwd: repositoryPath,
      env: commitEnv,
      input: "synthetic scanner integration check\n",
      label: "create private synthetic audit commit",
    }).stdout.trim();
    runGit(["update-ref", privateRef("public", 0), commit], {
      cwd: repositoryPath,
      env,
      label: "publish private synthetic audit ref",
    });
    const findings = scanRepository(
      scannerPath,
      configPath,
      ignorePath,
      repositoryPath,
      "--full-history --diff-filter=tuxdb --all",
      env,
    );
    if (findings.length !== 1) {
      fail("policy-pinned Gitleaks smoke scan did not produce one sanitized finding");
    }
    console.log("Verified policy-pinned Gitleaks execution and finding sanitization.");
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}

async function main() {
  if (process.platform !== "linux" || process.arch !== "x64") {
    fail("the protected security audit requires Linux x64");
  }
  const contaminants = environmentContaminants();
  if (contaminants.length) {
    fail(`security audit refuses inherited Git/Gitleaks configuration: ${contaminants.join(", ")}`);
  }
  if (process.argv.length === 3 && process.argv[2] === "--self-test") {
    await runScannerSelfTest();
    return;
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const output = resolve(root, parseArguments(process.argv.slice(2)));
  const candidate = parseJson(readFileSync(resolve(root, "release/candidate.json")), "candidate");
  const expectedOutput = resolve(root, candidate.securityAuditEvidence);
  if (output !== expectedOutput || !output.startsWith(`${root}${sep}`)) {
    fail("security audit output must use the candidate's exact repository-local evidence path");
  }
  if (process.env.GITHUB_ACTIONS === "true") {
    if (process.env.GITHUB_REF !== "refs/heads/main") {
      fail("protected security audit may run only against refs/heads/main");
    }
    const head = runCommand("git", ["rev-parse", "HEAD"], {
      cwd: root,
      env: sterileEnvironment(tmpdir()),
      label: "coordination checkout identity",
    }).stdout.trim();
    if (process.env.GITHUB_SHA !== head) fail("coordination checkout does not match GITHUB_SHA");
  }

  const allowlistPolicy = readPolicyJson(resolve(root, "release/security-allowlist.json"));
  const allowlistSha256 = sha256(allowlistPolicy.bytes);
  const completedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const archive = await downloadPinnedArchive();
  const auditRoot = mkdtempSync(resolve(tmpdir(), "jumpgate-security-audit-"));
  try {
    const first = generateReplica({
      root: auditRoot,
      archive,
      completedAt,
      candidate,
      allowlist: allowlistPolicy.value,
      allowlistSha256,
    });
    const second = generateReplica({
      root: auditRoot,
      archive,
      completedAt,
      candidate,
      allowlist: allowlistPolicy.value,
      allowlistSha256,
    });
    const firstBytes = canonicalBytes(first);
    const secondBytes = canonicalBytes(second);
    if (!firstBytes.equals(secondBytes)) {
      fail("independent security audit replicas did not produce identical sanitized reports");
    }
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, firstBytes, { mode: 0o600 });
    const unresolved = first.repositories.flatMap((record) =>
      record.unresolvedFindingFingerprints.map((fingerprint) => `${record.repository}:${fingerprint}`),
    );
    if (unresolved.length) {
      fail(
        `security audit found unresolved fingerprints in ${output}:\n${unresolved.join("\n")}`,
      );
    }
    validateSecurityAudit(
      first,
      candidate,
      new Date(completedAt),
      allowlistPolicy.value,
      allowlistSha256,
    );
    const counts = first.repositories
      .map((record) => `${record.repository}=${record.rawFindingFingerprints.length}`)
      .join(", ");
    console.log(`Reproduced sanitized Jumpgate security audit (${counts}).`);
  } finally {
    rmSync(auditRoot, { recursive: true, force: true });
  }
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
