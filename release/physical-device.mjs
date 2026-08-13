import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, delimiter, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const TARGET_SCHEMA_VERSION = 1;
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 300_000;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const SAFE_TARGET_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/;
const SAFE_SERIAL = /^[A-Za-z0-9][A-Za-z0-9._:[\]-]{0,254}$/;
const SAFE_PROPERTY = /^[A-Za-z0-9][A-Za-z0-9 ._()+/-]{0,79}$/;
const RESERVED_TARGET_NAMES = new Set(["__proto__", "constructor", "prototype"]);
const EMULATOR_MARKER = /(?:^|[^a-z0-9])(emulator|qemu|avd|sdk[_ -]?gphone[a-z0-9_-]*|genymotion|vbox|ranchu|goldfish|generic[_ -]?(?:x86(?:_64)?|arm64)|android sdk built for x86(?:_64)?|cuttlefish|vsoc|aosp[_ -]?cf)(?:[^a-z0-9]|$)/i;
const EMULATOR_DESCRIPTOR = /(?:^|\s)(?:product:(?:sdk|aosp_cf)\S*|model:(?:sdk_gphone|cuttlefish)\S*|device:(?:emu|vsoc)\S*)(?:\s|$)/i;
const LOOPBACK_SERIAL = /^(?:localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)(?::\d+)?$/i;
const ALLOWED_ADB_COMMANDS = new Set([
  "bugreport",
  "install",
  "install-multiple",
  "logcat",
  "pull",
  "push",
  "shell",
  "uninstall",
]);
const ALLOWED_SHELL_COMMANDS = new Set([
  "am",
  "cat",
  "df",
  "dumpsys",
  "du",
  "getprop",
  "input",
  "ls",
  "pidof",
  "pm",
  "screencap",
  "screenrecord",
  "settings",
  "stat",
  "true",
]);
const SHELL_META = /[\s;&|`$<>\\'"\r\n]/;
const DISALLOWED_COMMANDS = new Set([
  "connect",
  "disconnect",
  "devices",
  "disable-verity",
  "enable-verity",
  "kill-server",
  "reboot",
  "root",
  "sideload",
  "start-server",
  "tcpip",
  "unroot",
  "usb",
]);

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function assertExactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("target_config_invalid", `${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.join("\n") !== expected.join("\n")) {
    fail("target_config_invalid", `${label} has unexpected or missing fields`);
  }
}

function assertSafeText(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value) || /[\u0000-\u001f\u007f]/.test(value)) {
    fail("target_config_invalid", `${label} is invalid`);
  }
  return value;
}

export function validateTargetConfiguration(configuration) {
  assertExactKeys(configuration, ["schemaVersion", "targets"], "target configuration");
  if (configuration.schemaVersion !== TARGET_SCHEMA_VERSION) {
    fail("target_config_invalid", `target configuration schemaVersion must be ${TARGET_SCHEMA_VERSION}`);
  }
  if (
    !configuration.targets ||
    typeof configuration.targets !== "object" ||
    Array.isArray(configuration.targets) ||
    Object.keys(configuration.targets).length < 1 ||
    Object.keys(configuration.targets).length > 8
  ) {
    fail("target_config_invalid", "targets must contain between one and eight records");
  }

  const validated = {};
  for (const [name, target] of Object.entries(configuration.targets)) {
    assertSafeText(name, SAFE_TARGET_NAME, "target name");
    if (RESERVED_TARGET_NAMES.has(name.toLowerCase())) {
      fail("target_config_invalid", "target name is reserved");
    }
    assertExactKeys(
      target,
      ["deviceClass", "serial", "connect", "manufacturer", "model"],
      `target ${name}`,
    );
    if (!new Set(["phone", "tv"]).has(target.deviceClass)) {
      fail("target_config_invalid", `target ${name} deviceClass must be phone or tv`);
    }
    const serial = assertSafeText(target.serial, SAFE_SERIAL, `target ${name} serial`);
    if (LOOPBACK_SERIAL.test(serial) || EMULATOR_MARKER.test(serial)) {
      fail("emulator_refused", `target ${name} is not an approved physical-device serial`);
    }
    if (typeof target.connect !== "boolean") {
      fail("target_config_invalid", `target ${name} connect must be boolean`);
    }
    validated[name] = Object.freeze({
      deviceClass: target.deviceClass,
      serial,
      connect: target.connect,
      manufacturer: assertSafeText(target.manufacturer, SAFE_PROPERTY, `target ${name} manufacturer`),
      model: assertSafeText(target.model, SAFE_PROPERTY, `target ${name} model`),
    });
  }
  return Object.freeze({ schemaVersion: TARGET_SCHEMA_VERSION, targets: Object.freeze(validated) });
}

function assertPrivateTargetsPath(path) {
  const privateRoot = resolve(".uat");
  mkdirSync(privateRoot, { recursive: true });
  const privateRootStat = lstatSync(privateRoot);
  if (!privateRootStat.isDirectory() || privateRootStat.isSymbolicLink()) {
    fail("target_config_invalid", "ignored .uat must be a real repository directory");
  }
  const physicalPrivateRoot = realpathSync.native(privateRoot);
  if (physicalPrivateRoot !== privateRoot) {
    fail("target_config_invalid", "ignored .uat may not resolve outside its repository path");
  }
  const candidate = resolve(path);
  let physicalParent;
  try {
    physicalParent = realpathSync.native(dirname(candidate));
  } catch (_error) {
    fail("target_config_invalid", "physical-target configuration parent must already exist inside ignored .uat");
  }
  const physicalCandidate = resolve(physicalParent, basename(candidate));
  const fromPrivateRoot = relative(physicalPrivateRoot, physicalCandidate);
  if (
    !fromPrivateRoot ||
    fromPrivateRoot === ".." ||
    fromPrivateRoot.startsWith(`..${sep}`) ||
    isAbsolute(fromPrivateRoot)
  ) {
    fail("target_config_invalid", "physical-target configuration must stay inside ignored .uat");
  }
  return physicalCandidate;
}

function executableCandidates(env = process.env) {
  const candidates = [];
  for (const root of [env.ANDROID_HOME, env.ANDROID_SDK_ROOT]) {
    if (root) candidates.push(resolve(root, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb"));
  }
  if (process.platform === "win32") {
    candidates.push(resolve(homedir(), "AppData", "Local", "Android", "Sdk", "platform-tools", "adb.exe"));
  }
  for (const directory of String(env.PATH || "").split(delimiter).filter(Boolean)) {
    candidates.push(resolve(directory, process.platform === "win32" ? "adb.exe" : "adb"));
  }
  return [...new Set(candidates)];
}

export function resolveAdbExecutable(env = process.env, fileExists = existsSync) {
  const executable = executableCandidates(env).find((candidate) => fileExists(candidate));
  if (!executable) fail("adb_unavailable", "Android platform-tools adb executable was not found");
  return executable;
}

function defaultRunner(executable, args, options) {
  return spawnSync(executable, args, options);
}

function runAdb(executable, args, runner, timeoutMs, label) {
  const result = runner(executable, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: timeoutMs,
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  if (!result || result.error || result.status !== 0) {
    fail("adb_operation_failed", `${label} failed before a safe device result was proven`);
  }
  return {
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
  };
}

function connectTarget(executable, target, runner, timeoutMs) {
  if (!target.connect) return;
  const result = runAdb(executable, ["connect", target.serial], runner, timeoutMs, "ADB transport connection");
  if (!/(?:connected to|already connected to)/i.test(result.stdout + result.stderr)) {
    fail("adb_operation_failed", "ADB transport did not confirm the configured target");
  }
}

function assertPhysicalDescriptor(executable, target, runner, timeoutMs) {
  const result = runAdb(executable, ["devices", "-l"], runner, timeoutMs, "ADB target inventory");
  const line = result.stdout
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${target.serial}\t`));
  if (!line || !/^\S+\tdevice(?:\s|$)/.test(line)) {
    fail("device_unavailable", "configured physical target is not in ADB device state");
  }
  if (EMULATOR_MARKER.test(line) || EMULATOR_DESCRIPTOR.test(line)) {
    fail("emulator_refused", "ADB target descriptor identifies an emulator or virtual device");
  }
}

function parseMediaVolume(output) {
  const matches = [...String(output).matchAll(/\bvolume\s+(?:is\s+)?(?:index=)?(\d+)\b/gi)];
  if (matches.length !== 1) {
    fail("volume_unverified", "ADB did not return one unambiguous numeric media volume");
  }
  return Number.parseInt(matches[0][1], 10);
}

function setAndVerifyZero(executable, target, runner, timeoutMs) {
  runAdb(
    executable,
    ["-s", target.serial, "shell", "cmd", "media_session", "volume", "--stream", "3", "--set", "0"],
    runner,
    timeoutMs,
    "numeric media-volume zeroing",
  );
  const readback = runAdb(
    executable,
    ["-s", target.serial, "shell", "cmd", "media_session", "volume", "--stream", "3", "--get"],
    runner,
    timeoutMs,
    "numeric media-volume verification",
  );
  if (parseMediaVolume(readback.stdout + readback.stderr) !== 0) {
    fail("volume_unverified", "physical-device media volume is not numeric zero");
  }
}

function readPhysicalIdentity(executable, target, runner, timeoutMs, expectedIdentity = true) {
  const properties = [
    "ro.kernel.qemu",
    "ro.boot.qemu",
    "ro.product.manufacturer",
    "ro.product.model",
    "ro.hardware",
  ];
  const values = properties.map((property) =>
    runAdb(
      executable,
      ["-s", target.serial, "shell", "getprop", property],
      runner,
      timeoutMs,
      "physical-device identity verification",
    ).stdout.trim(),
  );
  const [kernelQemu, bootQemu, manufacturer, model, hardware] = values;
  if (kernelQemu === "1" || bootQemu === "1" || EMULATOR_MARKER.test(`${manufacturer} ${model} ${hardware}`)) {
    fail("emulator_refused", "Android properties identify an emulator or virtual device");
  }
  if (expectedIdentity && (manufacturer !== target.manufacturer || model !== target.model)) {
    fail("device_identity_mismatch", "Android target identity does not match the private physical-device record");
  }
  if (!SAFE_PROPERTY.test(manufacturer) || !SAFE_PROPERTY.test(model)) {
    fail("device_identity_invalid", "Android target returned an invalid manufacturer or model");
  }
  return Object.freeze({ manufacturer, model });
}

function validateRequestedCommand(args) {
  if (!Array.isArray(args) || args.length < 1 || args.length > 128) {
    fail("device_command_invalid", "one bounded ADB device command is required");
  }
  for (const value of args) {
    if (typeof value !== "string" || value.length < 1 || value.length > 4096 || /[\u0000\r\n]/.test(value)) {
      fail("device_command_invalid", "ADB command arguments must be bounded single-line strings");
    }
  }
  const operation = args[0].toLowerCase();
  if (args[0].startsWith("-") || DISALLOWED_COMMANDS.has(operation)) {
    fail("device_command_invalid", "host, transport, reboot, and privilege-changing ADB commands are not allowed");
  }
  if (!ALLOWED_ADB_COMMANDS.has(operation)) {
    fail("device_command_invalid", "ADB command is outside the physical-UAT allowlist");
  }
  if (operation === "shell") {
    if (args.length < 2 || !ALLOWED_SHELL_COMMANDS.has(args[1].toLowerCase())) {
      fail("device_command_invalid", "Android shell command is outside the physical-UAT allowlist");
    }
    if (args.slice(1).some((value) => SHELL_META.test(value))) {
      fail("device_command_invalid", "Android shell metacharacters are not allowed");
    }
    const shellOperation = args[1].toLowerCase();
    if (shellOperation === "settings" && !new Set(["get", "list"]).has(args[2]?.toLowerCase())) {
      fail("device_command_invalid", "guarded settings commands are read-only");
    }
    if (shellOperation === "input" && args[2]?.toLowerCase() === "keyevent") {
      const keys = args.slice(3).map((value) => value.toLowerCase());
      if (keys.some((value) => {
        if (/^(?:volume_(?:up|down|mute)|keycode_volume_(?:up|down|mute))$/.test(value)) return true;
        if (!/^\+?\d+$/.test(value)) return false;
        return new Set([24, 25, 164]).has(Number.parseInt(value, 10));
      })) {
        fail("device_command_invalid", "the requested command may not mutate Android audio volume");
      }
    }
  }
  const normalized = args.join(" ").toLowerCase();
  if (
    /(?:media_session|\bmedia)\s+volume\b/.test(normalized) ||
    /\bservice\s+call\s+audio\b/.test(normalized) ||
    /\bsettings\b.*\b(?:put|delete|reset)\b.*\b(?:volume_|sound|audio)\b/.test(normalized) ||
    /\b(?:keycode_)?volume_(?:up|down|mute)\b/.test(normalized) ||
    (operation === "shell" && args[1].toLowerCase() === "input" &&
      args.slice(2).some((value) => /^(?:24|25|164)$/.test(value)))
  ) {
    fail("device_command_invalid", "the requested command may not mutate Android audio volume");
  }
  return [...args];
}

export function guardAndRun(configuration, targetName, commandArgs, options = {}) {
  const validated = validateTargetConfiguration(configuration);
  if (
    !SAFE_TARGET_NAME.test(String(targetName || "")) ||
    !Object.prototype.hasOwnProperty.call(validated.targets, targetName)
  ) {
    fail("target_config_invalid", "requested physical target is not configured");
  }
  const target = validated.targets[targetName];
  const command = validateRequestedCommand(commandArgs);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > MAX_TIMEOUT_MS) {
    fail("device_command_invalid", `timeoutMs must be between 1000 and ${MAX_TIMEOUT_MS}`);
  }
  const runner = options.runner || defaultRunner;
  const executable = options.adbExecutable || resolveAdbExecutable(options.env);

  connectTarget(executable, target, runner, timeoutMs);
  assertPhysicalDescriptor(executable, target, runner, timeoutMs);
  let result;
  let commandError = null;
  try {
    setAndVerifyZero(executable, target, runner, timeoutMs);
    readPhysicalIdentity(executable, target, runner, timeoutMs);
    result = runAdb(
      executable,
      ["-s", target.serial, ...command],
      runner,
      timeoutMs,
      "guarded physical-device command",
    );
  } catch (error) {
    commandError = error;
  }

  try {
    setAndVerifyZero(executable, target, runner, timeoutMs);
  } catch (restoreError) {
    fail("volume_restore_failed", "numeric media volume zero could not be re-verified after the device command");
  }
  if (commandError) throw commandError;
  return Object.freeze({
    deviceClass: target.deviceClass,
    stdout: result.stdout,
    stderr: result.stderr,
    volume: 0,
  });
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(temporary, path);
  } catch (error) {
    try {
      if (existsSync(temporary)) unlinkSync(temporary);
    } catch (_cleanupError) {
      // The target path is ignored; avoid masking the original persistence failure.
    }
    fail("target_config_write_failed", "private physical-target configuration could not be written atomically");
  }
}

export function enrollTarget(enrollment, options = {}) {
  assertExactKeys(
    enrollment,
    ["targetName", "deviceClass", "serial", "connect", "targetsPath", "replace"],
    "target enrollment",
  );
  const targetName = assertSafeText(enrollment.targetName, SAFE_TARGET_NAME, "target name");
  if (RESERVED_TARGET_NAMES.has(targetName.toLowerCase())) {
    fail("target_config_invalid", "target name is reserved");
  }
  if (!new Set(["phone", "tv"]).has(enrollment.deviceClass)) {
    fail("target_config_invalid", "deviceClass must be phone or tv");
  }
  const serial = assertSafeText(enrollment.serial, SAFE_SERIAL, "target serial");
  if (LOOPBACK_SERIAL.test(serial) || EMULATOR_MARKER.test(serial)) {
    fail("emulator_refused", "target is not an approved physical-device serial");
  }
  if (typeof enrollment.connect !== "boolean" || typeof enrollment.replace !== "boolean") {
    fail("target_config_invalid", "connect and replace must be boolean");
  }
  const targetsPath = assertPrivateTargetsPath(enrollment.targetsPath);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > MAX_TIMEOUT_MS) {
    fail("device_command_invalid", `timeoutMs must be between 1000 and ${MAX_TIMEOUT_MS}`);
  }
  const runner = options.runner || defaultRunner;
  const executable = options.adbExecutable || resolveAdbExecutable(options.env);
  let configuration = { schemaVersion: TARGET_SCHEMA_VERSION, targets: {} };
  if (existsSync(targetsPath)) configuration = validateTargetConfiguration(readJson(targetsPath));
  if (configuration.targets[targetName] && !enrollment.replace) {
    fail("target_config_exists", `target ${targetName} already exists; pass --replace to replace it`);
  }
  const provisional = Object.freeze({
    deviceClass: enrollment.deviceClass,
    serial,
    connect: enrollment.connect,
    manufacturer: "Pending",
    model: "Pending",
  });

  connectTarget(executable, provisional, runner, timeoutMs);
  assertPhysicalDescriptor(executable, provisional, runner, timeoutMs);
  let identity;
  let enrollmentError = null;
  try {
    setAndVerifyZero(executable, provisional, runner, timeoutMs);
    identity = readPhysicalIdentity(executable, provisional, runner, timeoutMs, false);
  } catch (error) {
    enrollmentError = error;
  }
  try {
    setAndVerifyZero(executable, provisional, runner, timeoutMs);
  } catch (_restoreError) {
    fail("volume_restore_failed", "numeric media volume zero could not be re-verified after enrollment");
  }
  if (enrollmentError) throw enrollmentError;

  const output = {
    schemaVersion: TARGET_SCHEMA_VERSION,
    targets: {
      ...configuration.targets,
      [targetName]: {
        deviceClass: enrollment.deviceClass,
        serial,
        connect: enrollment.connect,
        manufacturer: identity.manufacturer,
        model: identity.model,
      },
    },
  };
  (options.writer || writeJsonAtomic)(targetsPath, output);
  return Object.freeze({
    targetName,
    deviceClass: enrollment.deviceClass,
    manufacturer: identity.manufacturer,
    model: identity.model,
    volume: 0,
  });
}

function parseCliArguments(args) {
  if (args[0] !== "run") {
    fail(
      "usage",
      "usage: physical-device.mjs enroll|run (use enroll --target NAME --device-class phone|tv --serial SERIAL [--connect])",
    );
  }
  const separator = args.indexOf("--");
  if (separator < 0) fail("usage", "device command must follow --");
  const options = { targetsPath: resolve(".uat", "physical-targets.json"), timeoutMs: DEFAULT_TIMEOUT_MS };
  for (let index = 1; index < separator; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!value) fail("usage", `${name || "option"} requires a value`);
    if (name === "--target") options.targetName = value;
    else if (name === "--targets") options.targetsPath = assertPrivateTargetsPath(value);
    else if (name === "--timeout-ms") options.timeoutMs = Number(value);
    else fail("usage", `unknown option: ${name}`);
  }
  if (!options.targetName) fail("usage", "--target is required");
  return { ...options, commandArgs: args.slice(separator + 1) };
}

function parseEnrollmentArguments(args) {
  const options = {
    targetsPath: resolve(".uat", "physical-targets.json"),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    connect: false,
    replace: false,
  };
  for (let index = 1; index < args.length; index += 1) {
    const name = args[index];
    if (name === "--connect" || name === "--replace") {
      options[name.slice(2)] = true;
      continue;
    }
    const value = args[index + 1];
    if (!value) fail("usage", `${name || "option"} requires a value`);
    if (name === "--target") options.targetName = value;
    else if (name === "--device-class") options.deviceClass = value;
    else if (name === "--serial") options.serial = value;
    else if (name === "--targets") options.targetsPath = assertPrivateTargetsPath(value);
    else if (name === "--timeout-ms") options.timeoutMs = Number(value);
    else fail("usage", `unknown option: ${name}`);
    index += 1;
  }
  if (!options.targetName || !options.deviceClass || !options.serial) {
    fail("usage", "enroll requires --target, --device-class, and --serial");
  }
  return options;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (_error) {
    fail("target_config_invalid", "private physical-target configuration could not be read");
  }
}

export function runCli(args = process.argv.slice(2)) {
  if (args[0] === "enroll") {
    const parsed = parseEnrollmentArguments(args);
    const result = enrollTarget({
      targetName: parsed.targetName,
      deviceClass: parsed.deviceClass,
      serial: parsed.serial,
      connect: parsed.connect,
      targetsPath: parsed.targetsPath,
      replace: parsed.replace,
    }, { timeoutMs: parsed.timeoutMs });
    process.stderr.write(
      `Enrolled ${result.targetName} as ${result.manufacturer} ${result.model} with numeric media volume 0 verified.\n`,
    );
    return;
  }
  const parsed = parseCliArguments(args);
  const result = guardAndRun(
    readJson(parsed.targetsPath),
    parsed.targetName,
    parsed.commandArgs,
    { timeoutMs: parsed.timeoutMs },
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.stderr.write(`Guarded ${result.deviceClass} command completed with numeric media volume 0 verified.\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error.code || "device_guard_failed"}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
