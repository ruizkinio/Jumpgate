import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import {
  KODI_RELEASE_POLICY,
  parseEvidenceBlobUrl,
  requiredUatCasesForDevice,
  stremioCandidateSha256,
  validateCandidate,
  validateEvidence,
  validateUatReport,
} from "./validate-release.mjs";
import { validatePublicEvidencePng } from "./png-evidence.mjs";

const WORKBOOK_SCHEMA_VERSION = 3;
const UAT_REPORT_SCHEMA_VERSION = 4;
export const VOBSUB_RENDER_CUES = Object.freeze([
  Object.freeze({ cue: 1, text: "JUMPGATE VOBSUB 1", windowStartMs: 2_000, windowEndMs: 5_000 }),
  Object.freeze({ cue: 2, text: "JUMPGATE VOBSUB 2", windowStartMs: 7_000, windowEndMs: 10_000 }),
  Object.freeze({ cue: 3, text: "JUMPGATE VOBSUB 3", windowStartMs: 12_000, windowEndMs: 15_000 }),
]);
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const OBSERVATION_REJECTIONS = [
  [/(?:https?|stremio):\/\//i, "URLs"],
  [/\b(?:bearer|authorization|cookie|password|secret|token)\b/i, "credential terms"],
  [/\b[A-Z0-9]{4}-[A-Z0-9]{4}\b/i, "pairing-code shaped text"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/, "IP addresses"],
  [/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/, "email addresses"],
  [/\b[0-9a-f]{32,}\b/i, "long hexadecimal values"],
  [/[?&][A-Za-z0-9_.~-]+=/, "URL query parameters"],
];

function fail(message) {
  throw new Error(message);
}

function assertExactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.join("\n") !== expected.join("\n")) fail(`${label} has unexpected or missing fields`);
}

function candidateRecord(candidate) {
  return {
    coordinatedVersion: candidate.coordinatedVersion,
    bridgeCommit: candidate.components.bridge.commit,
    bridgeImageDigest: candidate.components.bridge.imageDigest,
    kodiCommit: candidate.components.kodi.commit,
    stremioCandidateSha256: stremioCandidateSha256(candidate.stremio),
  };
}

function bridgeRecord(candidate) {
  return {
    version: candidate.coordinatedVersion,
    buildSha: candidate.components.bridge.commit,
    imageDigest: candidate.components.bridge.imageDigest,
  };
}

function assertSame(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${label} does not match the locked candidate`);
}

function validateDeviceInput(input, candidate) {
  const { deviceClass, manufacturer, model, androidApi, abi } = input;
  if (!new Set(["phone", "tv"]).has(deviceClass)) fail("deviceClass must be phone or tv");
  for (const [name, value] of [["manufacturer", manufacturer], ["model", model]]) {
    if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9 ._()+-]{1,79}$/.test(value)) {
      fail(`${name} must be a sanitized public device label`);
    }
  }
  if (/(emulator|simulator|sdk[_ -]?gphone|android sdk|qemu|avd|virtualbox|genymotion)/i.test(`${manufacturer} ${model}`)) {
    fail("release evidence requires a physical device");
  }
  if (!Number.isInteger(androidApi) || androidApi < 24 || androidApi > 99) {
    fail("androidApi must be a supported Android API integer");
  }
  if (!new Set(["arm64-v8a", "armeabi-v7a"]).has(abi)) fail("abi is not supported");
  const app = candidate.stremio.apps[deviceClass === "phone" ? "mobile" : "tv"];
  const stremioArtifact = app.artifacts[abi];
  const jumpgateArtifact = candidate.components.kodi.artifacts[abi];
  return {
    deviceClass,
    manufacturer,
    model,
    androidApi,
    abi,
    jumpgateApkSha256: jumpgateArtifact.apkSha256,
    jumpgateSignerSha256: KODI_RELEASE_POLICY.signer.certificateSha256,
    stremioPackageName: candidate.stremio.packageName,
    stremioVersionName: app.versionName,
    stremioVersionCode: stremioArtifact.versionCode,
    stremioApkSha256: stremioArtifact.apkSha256,
    stremioSignerSha256: candidate.stremio.signerCertificateSha256,
  };
}

export function assertSanitizedObservation(observation) {
  if (
    typeof observation !== "string" || observation.length < 1 || observation.length > 500 ||
    observation.trim() !== observation || /[\u0000-\u001f\u007f]/.test(observation)
  ) {
    fail("observation must be 1-500 trimmed printable characters");
  }
  for (const [pattern, label] of OBSERVATION_REJECTIONS) {
    if (pattern.test(observation)) fail(`observation must not contain ${label}`);
  }
  return observation;
}

function emptyVobSubRenderEvidence() {
  return VOBSUB_RENDER_CUES.map((cue) => ({
    ...cue,
    status: "pending",
    sha256: "",
    capturePath: "",
    visualReview: "pending",
    privacyReview: "pending",
  }));
}

function validateVobSubRenderEvidence(entries, deviceClass, allowPending) {
  if (!Array.isArray(entries) || entries.length !== VOBSUB_RENDER_CUES.length) {
    fail("VobSub render evidence must contain exactly three cue captures");
  }
  for (const [index, entry] of entries.entries()) {
    assertExactKeys(
      entry,
      ["cue", "text", "windowStartMs", "windowEndMs", "status", "sha256", "capturePath", "visualReview", "privacyReview"],
      `VobSub cue ${index + 1}`,
    );
    const expected = VOBSUB_RENDER_CUES[index];
    assertSame(
      { cue: entry.cue, text: entry.text, windowStartMs: entry.windowStartMs, windowEndMs: entry.windowEndMs },
      expected,
      `VobSub cue ${index + 1}`,
    );
    if (
      entry.status === "pending" && allowPending && entry.sha256 === "" &&
      entry.capturePath === "" && entry.visualReview === "pending" && entry.privacyReview === "pending"
    ) continue;
    if (entry.status !== "pass" || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      fail(`VobSub cue ${index + 1} requires a passed PNG capture SHA-256`);
    }
    if (entry.capturePath !== `release/evidence/${deviceClass}-vobsub-cue-${index + 1}.png`) {
      fail(`VobSub cue ${index + 1} capture path is not canonical`);
    }
    if (entry.visualReview !== "cue-and-time-rail-confirmed" || entry.privacyReview !== "sanitized-for-publication") {
      fail(`VobSub cue ${index + 1} requires visual and privacy review attestations`);
    }
  }
  const hashes = entries.filter((entry) => entry.status === "pass").map((entry) => entry.sha256);
  if (new Set(hashes).size !== hashes.length) fail("VobSub cue captures must be distinct images");
  return entries;
}

export function createWorkbook(candidate, input, now = new Date()) {
  validateCandidate(candidate);
  const device = validateDeviceInput(input, candidate);
  return {
    schemaVersion: WORKBOOK_SCHEMA_VERSION,
    candidate: candidateRecord(candidate),
    device,
    bridge: bridgeRecord(candidate),
    createdAt: now.toISOString(),
    vobsubRenderEvidence: emptyVobSubRenderEvidence(),
    cases: requiredUatCasesForDevice(device.deviceClass).map((id) => ({
      id,
      status: "pending",
      observation: "",
    })),
  };
}

export function validateWorkbook(workbook, candidate) {
  validateCandidate(candidate);
  assertExactKeys(workbook, ["schemaVersion", "candidate", "device", "bridge", "createdAt", "vobsubRenderEvidence", "cases"], "workbook");
  if (workbook.schemaVersion !== WORKBOOK_SCHEMA_VERSION) fail("unsupported workbook schemaVersion");
  assertSame(workbook.candidate, candidateRecord(candidate), "workbook candidate");
  assertSame(workbook.bridge, bridgeRecord(candidate), "workbook Bridge");
  const expectedDevice = validateDeviceInput(workbook.device, candidate);
  assertExactKeys(workbook.device, Object.keys(expectedDevice), "workbook device");
  assertSame(workbook.device, expectedDevice, "workbook device");
  if (Number.isNaN(new Date(workbook.createdAt).valueOf())) fail("workbook createdAt is invalid");
  validateVobSubRenderEvidence(workbook.vobsubRenderEvidence, workbook.device.deviceClass, true);
  const requiredCases = requiredUatCasesForDevice(workbook.device.deviceClass);
  if (!Array.isArray(workbook.cases) || workbook.cases.length !== requiredCases.length) {
    fail(`workbook must contain every UAT case required for ${workbook.device.deviceClass}`);
  }
  for (const [index, entry] of workbook.cases.entries()) {
    assertExactKeys(entry, ["id", "status", "observation"], `workbook case ${index}`);
    if (entry.id !== requiredCases[index]) fail("workbook cases must remain in device policy order");
    if (!new Set(["pending", "pass"]).has(entry.status)) fail(`${entry.id} has an invalid status`);
    if (entry.status === "pending" && entry.observation !== "") fail(`${entry.id} pending observation must be empty`);
    if (entry.status === "pass") assertSanitizedObservation(entry.observation);
  }
  return workbook;
}

export function recordVobSubCue(workbook, candidate, cue, captureBytes, { capturePath, visualReview, privacyReview } = {}) {
  validateWorkbook(workbook, candidate);
  if (!Number.isInteger(cue) || cue < 1 || cue > VOBSUB_RENDER_CUES.length) {
    fail("VobSub cue must be 1, 2, or 3");
  }
  validatePublicEvidencePng(captureBytes);
  if (visualReview !== "cue-and-time-rail-confirmed") {
    fail("VobSub cue capture requires --visual-review cue-and-time-rail-confirmed");
  }
  if (privacyReview !== "sanitized-for-publication") {
    fail("VobSub cue capture requires --privacy-review sanitized-for-publication");
  }
  const captureSha256 = sha256(captureBytes);
  const canonicalPath = `release/evidence/${workbook.device.deviceClass}-vobsub-cue-${cue}.png`;
  if (capturePath !== canonicalPath) fail(`VobSub cue capture must be read from ${canonicalPath}`);
  if (updatedVobSubHashes(workbook, cue).has(captureSha256)) fail("VobSub cue captures must be distinct images");
  const updated = structuredClone(workbook);
  updated.vobsubRenderEvidence[cue - 1] = {
    ...VOBSUB_RENDER_CUES[cue - 1],
    status: "pass",
    sha256: captureSha256,
    capturePath: canonicalPath,
    visualReview,
    privacyReview,
  };
  return validateWorkbook(updated, candidate);
}

export function recordPass(workbook, candidate, caseId, observation) {
  validateWorkbook(workbook, candidate);
  assertSanitizedObservation(observation);
  const requiredCases = requiredUatCasesForDevice(workbook.device.deviceClass);
  const index = requiredCases.indexOf(caseId);
  if (index < 0) fail(`UAT case is not required for ${workbook.device.deviceClass}: ${caseId}`);
  const updated = structuredClone(workbook);
  updated.cases[index] = { id: caseId, status: "pass", observation };
  return validateWorkbook(updated, candidate);
}

export function finalizeWorkbook(workbook, candidate, now = new Date()) {
  validateWorkbook(workbook, candidate);
  const pending = workbook.cases.filter((entry) => entry.status !== "pass");
  if (pending.length > 0) fail(`cannot finalize: ${pending.length} UAT cases remain pending`);
  validateVobSubRenderEvidence(workbook.vobsubRenderEvidence, workbook.device.deviceClass, false);
  const report = {
    schemaVersion: UAT_REPORT_SCHEMA_VERSION,
    candidate: workbook.candidate,
    device: workbook.device,
    testedAt: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    bridge: workbook.bridge,
    vobsubRenderEvidence: workbook.vobsubRenderEvidence,
    cases: workbook.cases,
  };
  validateUatReport(report, {
    ...report.device,
    testedAt: report.testedAt,
    vobsubCaptureSha256: report.vobsubRenderEvidence.map((capture) => capture.sha256),
  }, candidate);
  return report;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function updatedVobSubHashes(workbook, replacedCue) {
  return new Set(workbook.vobsubRenderEvidence
    .filter((entry) => entry.status === "pass" && entry.cue !== replacedCue)
    .map((entry) => entry.sha256));
}

export function createEvidenceIndex(candidate, reports, now = new Date()) {
  validateCandidate(candidate);
  if (!Array.isArray(reports) || reports.length !== 2) fail("exactly one phone and one TV report are required");
  const runs = reports.map(({ bytes, evidenceUrl }) => {
    if (!Buffer.isBuffer(bytes)) fail("report bytes must be a Buffer");
    const parsed = parseEvidenceBlobUrl(evidenceUrl);
    let report;
    try {
      report = JSON.parse(UTF8_DECODER.decode(bytes));
    } catch {
      fail("UAT report is not valid UTF-8 JSON");
    }
    const run = {
      ...report.device,
      testedAt: report.testedAt,
      evidenceSha256: sha256(bytes),
      evidenceUrl,
      caseCount: report.cases?.length,
      vobsubCaptureSha256: report.vobsubRenderEvidence?.map((capture) => capture.sha256),
    };
    if (parsed.repository !== "Jumpgate" || parsed.filePath !== `release/evidence/${run.deviceClass}.json`) {
      fail(`evidenceUrl must be the canonical immutable Jumpgate ${run.deviceClass} UAT report URL`);
    }
    validateUatReport(report, run, candidate);
    return run;
  });
  const index = { schemaVersion: 3, candidate: candidateRecord(candidate), runs };
  validateEvidence(index, candidate, now);
  return index;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`failed to read ${label}: ${error.message}`);
  }
}

function writeJsonAtomic(path, value) {
  const output = resolve(path);
  const temporary = `${output}.tmp-${process.pid}`;
  mkdirSync(dirname(output), { recursive: true });
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, output);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function required(values, name) {
  const value = values[name];
  if (typeof value !== "string" || value.length === 0) fail(`--${name} is required`);
  return value;
}

function parseStrictInteger(value, name) {
  if (!/^(?:0|[1-9][0-9]*)$/.test(value)) fail(`--${name} must be an integer`);
  return Number(value);
}

function cliOptions() {
  return {
    candidate: { type: "string", default: resolve(dirname(fileURLToPath(import.meta.url)), "candidate.json") },
    output: { type: "string" }, workbook: { type: "string" }, "device-class": { type: "string" },
    manufacturer: { type: "string" }, model: { type: "string" }, "android-api": { type: "string" },
    abi: { type: "string" }, case: { type: "string" }, observation: { type: "string" },
    cue: { type: "string" }, capture: { type: "string" }, "visual-review": { type: "string" },
    "privacy-review": { type: "string" },
    "phone-report": { type: "string" }, "phone-url": { type: "string" }, "tv-report": { type: "string" },
    "tv-url": { type: "string" },
  };
}

export function runCli(args = process.argv.slice(2)) {
  const [command, ...rest] = args;
  const { values } = parseArgs({ args: rest, options: cliOptions(), strict: true, allowPositionals: false });
  const candidate = readJson(values.candidate, "candidate");
  if (command === "init") {
    const workbook = createWorkbook(candidate, {
      deviceClass: required(values, "device-class"), manufacturer: required(values, "manufacturer"),
      model: required(values, "model"), androidApi: Number.parseInt(required(values, "android-api"), 10),
      abi: required(values, "abi"),
    });
    writeJsonAtomic(required(values, "output"), workbook);
    console.log(`Created ${workbook.device.deviceClass} workbook with ${workbook.cases.length} pending cases.`);
    return;
  }
  if (command === "record") {
    const path = required(values, "workbook");
    const updated = recordPass(readJson(path, "workbook"), candidate, required(values, "case"), required(values, "observation"));
    writeJsonAtomic(path, updated);
    console.log(`Recorded pass; ${updated.cases.filter((entry) => entry.status === "pending").length} cases remain.`);
    return;
  }
  if (command === "record-vobsub") {
    const path = required(values, "workbook");
    const updated = recordVobSubCue(
      readJson(path, "workbook"),
      candidate,
      parseStrictInteger(required(values, "cue"), "cue"),
      readFileSync(required(values, "capture")),
      {
        capturePath: required(values, "capture").replaceAll("\\", "/"),
        visualReview: required(values, "visual-review"),
        privacyReview: required(values, "privacy-review"),
      },
    );
    writeJsonAtomic(path, updated);
    console.log(`Recorded VobSub cue capture ${required(values, "cue")}.`);
    return;
  }
  if (command === "status") {
    const workbook = validateWorkbook(readJson(required(values, "workbook"), "workbook"), candidate);
    const pending = workbook.cases.filter((entry) => entry.status === "pending");
    const pendingCaptures = workbook.vobsubRenderEvidence.filter((entry) => entry.status === "pending");
    console.log(`${workbook.device.deviceClass}: ${workbook.cases.length - pending.length}/${workbook.cases.length} cases passed; ${3 - pendingCaptures.length}/3 VobSub captures recorded.`);
    for (const entry of pending) console.log(entry.id);
    for (const entry of pendingCaptures) console.log(`vobsub/cue-${entry.cue}`);
    return;
  }
  if (command === "finalize") {
    const report = finalizeWorkbook(readJson(required(values, "workbook"), "workbook"), candidate);
    writeJsonAtomic(required(values, "output"), report);
    console.log(`Finalized sanitized ${report.device.deviceClass} UAT report.`);
    return;
  }
  if (command === "index") {
    const index = createEvidenceIndex(candidate, [
      { bytes: readFileSync(required(values, "phone-report")), evidenceUrl: required(values, "phone-url") },
      { bytes: readFileSync(required(values, "tv-report")), evidenceUrl: required(values, "tv-url") },
    ]);
    writeJsonAtomic(required(values, "output"), index);
    console.log("Created physical UAT evidence index from immutable report bytes.");
    return;
  }
  fail("command must be init, record, record-vobsub, status, finalize, or index");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    runCli();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
