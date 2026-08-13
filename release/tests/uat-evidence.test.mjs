import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertSanitizedObservation,
  createEvidenceIndex,
  createWorkbook,
  finalizeWorkbook,
  recordPass,
  recordVobSubCue,
  validateWorkbook,
} from "../uat-evidence.mjs";
import {
  REQUIRED_UAT_CASES,
  requiredUatCasesForDevice,
  validateEvidence,
} from "../validate-release.mjs";
import { evidencePng } from "./png-fixture.mjs";

const candidate = JSON.parse(readFileSync(new URL("../candidate.json", import.meta.url), "utf8"));
const now = new Date("2026-08-13T12:00:00Z");

function input(deviceClass = "tv") {
  return {
    deviceClass,
    manufacturer: deviceClass === "tv" ? "Google" : "Samsung",
    model: deviceClass === "tv" ? "Google TV Streamer" : "Galaxy S24",
    androidApi: 35,
    abi: deviceClass === "tv" ? "armeabi-v7a" : "arm64-v8a",
  };
}

function completedReport(deviceClass) {
  let workbook = createWorkbook(candidate, input(deviceClass), now);
  for (const cue of [1, 2, 3]) workbook = recordVobSubCue(
    workbook,
    candidate,
    cue,
    evidencePng(cue + (deviceClass === "tv" ? 10 : 0)),
    { capturePath: `release/evidence/${deviceClass}-vobsub-cue-${cue}.png`, visualReview: "cue-and-time-rail-confirmed", privacyReview: "sanitized-for-publication" },
  );
  for (const [index, id] of requiredUatCasesForDevice(deviceClass).entries()) {
    workbook = recordPass(workbook, candidate, id, `Observed expected behavior for policy case ${index + 1}.`);
  }
  return finalizeWorkbook(workbook, candidate, now);
}

test("workbooks bind public candidate artifacts and exact device-scoped policy cases", () => {
  const workbook = createWorkbook(candidate, input(), now);
  assert.equal(validateWorkbook(workbook, candidate), workbook);
  assert.deepEqual(workbook.cases.map(({ id }) => id), requiredUatCasesForDevice("tv"));
  assert.equal(workbook.device.jumpgateApkSha256, candidate.components.kodi.artifacts["armeabi-v7a"].apkSha256);
  assert.equal(workbook.device.stremioVersionName, candidate.stremio.apps.tv.versionName);
  assert.throws(() => finalizeWorkbook(workbook, candidate, now), /remain pending/);
});

test("VobSub render evidence requires three bounded PNG captures", () => {
  let workbook = createWorkbook(candidate, input(), now);
  assert.throws(
    () => recordVobSubCue(workbook, candidate, 1, Buffer.from("not a PNG")),
    /PNG file/,
  );
  assert.throws(
    () => recordVobSubCue(workbook, candidate, 1, evidencePng(1)),
    /visual-review/,
  );
  assert.throws(
    () => recordVobSubCue(workbook, candidate, 1, evidencePng(1), { capturePath: "elsewhere.png", visualReview: "cue-and-time-rail-confirmed", privacyReview: "sanitized-for-publication" }),
    /must be read from release\/evidence/,
  );
  const review = (cue) => ({ capturePath: `release/evidence/tv-vobsub-cue-${cue}.png`, visualReview: "cue-and-time-rail-confirmed", privacyReview: "sanitized-for-publication" });
  workbook = recordVobSubCue(workbook, candidate, 1, evidencePng(1), review(1));
  assert.throws(
    () => recordVobSubCue(workbook, candidate, 2, evidencePng(1), review(2)),
    /distinct images/,
  );
  assert.throws(
    () => recordVobSubCue(workbook, candidate, 2, evidencePng(2, [{ type: "tEXt", data: Buffer.from("Account=test") }]), review(2)),
    /ancillary or private/,
  );
  for (const cue of [2, 3]) workbook = recordVobSubCue(workbook, candidate, cue, evidencePng(cue), review(cue));
  workbook = recordVobSubCue(workbook, candidate, 3, evidencePng(3), review(3));
  assert.deepEqual(workbook.vobsubRenderEvidence.map(({ cue, status }) => ({ cue, status })), [
    { cue: 1, status: "pass" },
    { cue: 2, status: "pass" },
    { cue: 3, status: "pass" },
  ]);
});

test("recording rejects unknown cases and secret-shaped observations", () => {
  const workbook = createWorkbook(candidate, input(), now);
  assert.throws(
    () => recordPass(workbook, candidate, "unknown/case", "Observed pass."),
    /not required for tv/,
  );
  for (const text of [
    "Observed https://private.example/path.",
    "Observed bearer value.",
    "Pairing value ABCD-EFGH accepted.",
    "Device used 192.168.1.4.",
    "Account test@example.com passed.",
    `Observed ${"a".repeat(40)}.`,
  ]) {
    assert.throws(() => assertSanitizedObservation(text), /must not contain/);
  }
});

test("phone workbooks cannot claim TV-only observations", () => {
  const workbook = createWorkbook(candidate, input("phone"), now);
  const tvOnly = "lifecycle/stremio-tv-premium-profile-return";
  assert.equal(workbook.cases.some(({ id }) => id === tvOnly), false);
  assert.equal(workbook.cases.length, REQUIRED_UAT_CASES.length - 2);
  assert.throws(
    () => recordPass(workbook, candidate, tvOnly, "Observed pass."),
    /not required for phone/,
  );

  const oldSchema = structuredClone(workbook);
  oldSchema.schemaVersion = 1;
  assert.throws(() => validateWorkbook(oldSchema, candidate), /unsupported workbook schemaVersion/);
});

test("completed reports and immutable index pass the release validators", () => {
  const phone = Buffer.from(`${JSON.stringify(completedReport("phone"), null, 2)}\n`);
  const tv = Buffer.from(`${JSON.stringify(completedReport("tv"), null, 2)}\n`);
  const index = createEvidenceIndex(candidate, [
    {
      bytes: phone,
      evidenceUrl: `https://github.com/ruizkinio/Jumpgate/blob/${"a".repeat(40)}/release/evidence/phone.json`,
    },
    {
      bytes: tv,
      evidenceUrl: `https://github.com/ruizkinio/Jumpgate/blob/${"b".repeat(40)}/release/evidence/tv.json`,
    },
  ], now);
  assert.equal(index.runs.length, 2);
  assert.equal(validateEvidence(index, candidate, now), index);
});

test("index creation rejects malformed UTF-8 report bytes", () => {
  const report = Buffer.from(`${JSON.stringify(completedReport("tv"), null, 2)}\n`);
  const malformed = Buffer.concat([report.subarray(0, -2), Buffer.from([0xc3, 0x28, 0x0a])]);
  assert.throws(() => createEvidenceIndex(candidate, [
    {
      bytes: Buffer.from(`${JSON.stringify(completedReport("phone"), null, 2)}\n`),
      evidenceUrl: `https://github.com/ruizkinio/Jumpgate/blob/${"a".repeat(40)}/release/evidence/phone.json`,
    },
    {
      bytes: malformed,
      evidenceUrl: `https://github.com/ruizkinio/Jumpgate/blob/${"b".repeat(40)}/release/evidence/tv.json`,
    },
  ], now), /valid UTF-8 JSON/);
});
