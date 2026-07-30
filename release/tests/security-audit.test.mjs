import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { gzipSync } from "node:zlib";

import {
  GITLEAKS_CONFIG,
  downloadPinnedArchive,
  environmentContaminants,
  extractPinnedGitleaks,
  findingFingerprint,
  normalizeFindingPath,
  parsePublicRefManifest,
  sanitizeFindings,
} from "../security-audit.mjs";
import { GITLEAKS_POLICY } from "../validate-release.mjs";

function tarEntry(name, body) {
  const bytes = Buffer.from(body);
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, "utf8");
  header.write("0000755\0", 100, 8, "ascii");
  header.write("0000000\0", 108, 8, "ascii");
  header.write("0000000\0", 116, 8, "ascii");
  header.write(`${bytes.length.toString(8).padStart(11, "0")}\0`, 124, 12, "ascii");
  header.write("00000000000\0", 136, 12, "ascii");
  header.fill(0x20, 148, 156);
  header[156] = 0x30;
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  let checksum = 0;
  for (const byte of header) checksum += byte;
  header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
  const padding = Buffer.alloc((512 - (bytes.length % 512)) % 512);
  return Buffer.concat([header, bytes, padding]);
}

function scannerTar(extra = []) {
  return gzipSync(Buffer.concat([
    tarEntry("LICENSE", "license"),
    tarEntry("README.md", "readme"),
    tarEntry("gitleaks", Buffer.alloc(1024 * 1024, 0x41)),
    ...extra,
    Buffer.alloc(1024),
  ]));
}

function finding(overrides = {}) {
  return {
    RuleID: "generic-api-key",
    Commit: "a".repeat(40),
    File: "./fixtures/example.txt",
    StartLine: 7,
    EndLine: 7,
    StartColumn: 3,
    EndColumn: 24,
    Secret: "must-never-enter-the-fingerprint",
    Match: "also-sensitive",
    ...overrides,
  };
}

test("finding fingerprints bind identity and location but never secret text", () => {
  const baseline = findingFingerprint(finding());
  assert.match(baseline, /^[0-9a-f]{64}$/);
  assert.equal(
    findingFingerprint(finding({ Secret: "different", Match: "different" })),
    baseline,
  );
  assert.notEqual(findingFingerprint(finding({ StartLine: 8, EndLine: 8 })), baseline);
  assert.equal(normalizeFindingPath(".\\fixtures\\example.txt"), "fixtures/example.txt");
  assert.throws(() => normalizeFindingPath("../private.txt"), /repository-relative/);
  assert.deepEqual(sanitizeFindings([finding(), finding({ Secret: "different" })]), [baseline]);
});

test("ambient Git and Gitleaks configuration is rejected deterministically", () => {
  assert.deepEqual(
    environmentContaminants({
      PATH: "/usr/bin",
      GITLEAKS_CONFIG: "/tmp/weaker.toml",
      GIT_CONFIG_KEY_0: "credential.helper",
      GIT_DIR: "/tmp/other.git",
    }),
    ["GITLEAKS_CONFIG", "GIT_CONFIG_KEY_0", "GIT_DIR"],
  );
  assert.deepEqual(environmentContaminants({ PATH: "/usr/bin", GITHUB_TOKEN: "opaque" }), []);
});

test("public ref manifests are exact, sorted, and reject unsafe refs", () => {
  assert.deepEqual(
    parsePublicRefManifest(
      `${"2".repeat(40)}\trefs/tags/v3.0.0\n${"1".repeat(40)}\trefs/heads/main\n`,
    ),
    [
      { name: "refs/heads/main", objectId: "1".repeat(40) },
      { name: "refs/tags/v3.0.0", objectId: "2".repeat(40) },
    ],
  );
  assert.throws(
    () => parsePublicRefManifest(`${"1".repeat(40)}\trefs/heads/../escape\n`),
    /safe public head or tag ref/,
  );
});

test("bounded tar extraction accepts only the pinned archive layout", () => {
  const executable = extractPinnedGitleaks(scannerTar());
  assert.equal(executable.length, 1024 * 1024);
  assert.throws(
    () => extractPinnedGitleaks(scannerTar([tarEntry("unexpected", "data")])),
    /unexpected entry/,
  );
});

test("scanner configuration bytes and archive downloads are cryptographically pinned", async () => {
  assert.equal(
    createHash("sha256").update(GITLEAKS_CONFIG).digest("hex"),
    GITLEAKS_POLICY.configSha256,
  );
  await assert.rejects(
    () =>
      downloadPinnedArchive(async () =>
        new Response("not-the-pinned-archive", {
          status: 200,
          headers: { "content-length": "22" },
        })),
    /SHA-256 does not match policy/,
  );
});
