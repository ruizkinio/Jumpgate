import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import {
  enrollTarget,
  guardAndRun,
  resolveAdbExecutable,
  validateTargetConfiguration,
} from "../physical-device.mjs";

function configuration(overrides = {}) {
  return {
    schemaVersion: 1,
    targets: {
      tv: {
        deviceClass: "tv",
        serial: "100.64.0.10:37123",
        connect: true,
        manufacturer: "Google",
        model: "Havana",
        ...overrides,
      },
    },
  };
}

function successfulRunner(calls, overrides = {}) {
  return (_executable, args) => {
    calls.push(args);
    const joined = args.join(" ");
    if (args[0] === "connect") return { status: 0, stdout: "connected to private-target\n", stderr: "" };
    if (joined === "devices -l") {
      return { status: 0, stdout: "List of devices attached\n100.64.0.10:37123\tdevice product:x model:Havana device:havana\n", stderr: "" };
    }
    if (joined.endsWith("media_session volume --stream 3 --get")) {
      return { status: 0, stdout: "volume is 0 in range [0..25]\n", stderr: "" };
    }
    if (joined.endsWith("getprop ro.kernel.qemu") || joined.endsWith("getprop ro.boot.qemu")) {
      return { status: 0, stdout: "0\n", stderr: "" };
    }
    if (joined.endsWith("getprop ro.product.manufacturer")) {
      return { status: 0, stdout: "Google\n", stderr: "" };
    }
    if (joined.endsWith("getprop ro.product.model")) {
      return { status: 0, stdout: "Havana\n", stderr: "" };
    }
    if (joined.endsWith("getprop ro.hardware")) {
      return { status: 0, stdout: "amlogic\n", stderr: "" };
    }
    if (joined.endsWith("shell getprop ro.build.version.sdk")) {
      return { status: 0, stdout: "35\n", stderr: "" };
    }
    if (joined.endsWith("media_session volume --stream 3 --set 0")) {
      return { status: 0, stdout: "", stderr: "" };
    }
    return overrides.defaultResult || { status: 1, stdout: "", stderr: "unexpected" };
  };
}

test("guard zeroes and verifies volume before command, then restores zero", () => {
  const calls = [];
  const result = guardAndRun(configuration(), "tv", ["shell", "getprop", "ro.build.version.sdk"], {
    adbExecutable: "adb",
    runner: successfulRunner(calls),
  });
  assert.equal(result.stdout, "35\n");
  assert.equal(result.volume, 0);
  const setIndices = calls
    .map((args, index) => args.join(" ").endsWith("media_session volume --stream 3 --set 0") ? index : -1)
    .filter((index) => index >= 0);
  const getIndices = calls
    .map((args, index) => args.join(" ").endsWith("media_session volume --stream 3 --get") ? index : -1)
    .filter((index) => index >= 0);
  const commandIndex = calls.findIndex((args) => args.join(" ").endsWith("shell getprop ro.build.version.sdk"));
  assert.deepEqual(setIndices.length, 2);
  assert.deepEqual(getIndices.length, 2);
  assert.ok(setIndices[0] < getIndices[0] && getIndices[0] < commandIndex);
  assert.ok(commandIndex < setIndices[1] && setIndices[1] < getIndices[1]);
  assert.deepEqual(calls[commandIndex].slice(0, 2), ["-s", "100.64.0.10:37123"]);
});

test("guard refuses ambiguous or nonzero readback before requested command", () => {
  for (const output of ["volume is 4 in range [0..25]\n", "", "volume 0\nvolume 1\n"]) {
    const calls = [];
    const base = successfulRunner(calls);
    const runner = (executable, args, options) =>
      args.join(" ").endsWith("media_session volume --stream 3 --get")
        ? { status: 0, stdout: output, stderr: "" }
        : base(executable, args, options);
    assert.throws(
      () => guardAndRun(configuration(), "tv", ["shell", "getprop", "ro.build.version.sdk"], {
        adbExecutable: "adb",
        runner,
      }),
      /numeric media volume|not numeric zero/,
    );
    assert.equal(calls.some((args) => args.join(" ").endsWith("shell getprop ro.build.version.sdk")), false);
  }
});

test("guard rejects emulator serials, descriptors, and Android properties", () => {
  for (const serial of ["emulator-5554", "127.0.0.1:5555", "localhost:5555", "qemu-device:5555"]) {
    assert.throws(() => validateTargetConfiguration(configuration({ serial })), /physical-device serial/);
  }

  const descriptorCalls = [];
  const descriptorBase = successfulRunner(descriptorCalls);
  const descriptorRunner = (executable, args, options) =>
    args.join(" ") === "devices -l"
      ? { status: 0, stdout: "100.64.0.10:37123\tdevice model:sdk_gphone64_x86_64 device:emu\n", stderr: "" }
      : descriptorBase(executable, args, options);
  assert.throws(
    () => guardAndRun(configuration(), "tv", ["shell", "true"], {
      adbExecutable: "adb",
      runner: descriptorRunner,
    }),
    /emulator or virtual device/,
  );
  assert.equal(descriptorCalls.some((args) => args.includes("media_session")), false);
  assert.equal(descriptorCalls.some((args) => args.join(" ").endsWith("shell true")), false);

  const propertyCalls = [];
  const propertyBase = successfulRunner(propertyCalls);
  const propertyRunner = (executable, args, options) =>
    args.join(" ").endsWith("getprop ro.kernel.qemu")
      ? { status: 0, stdout: "1\n", stderr: "" }
      : propertyBase(executable, args, options);
  assert.throws(
    () => guardAndRun(configuration(), "tv", ["shell", "true"], {
      adbExecutable: "adb",
      runner: propertyRunner,
    }),
    /emulator or virtual device/,
  );
  assert.equal(propertyCalls.some((args) => args.join(" ").endsWith("shell true")), false);
});

test("guard fails closed on target mismatch and always attempts zero restoration", () => {
  const mismatchCalls = [];
  assert.throws(
    () => guardAndRun(configuration({ model: "Expected TV" }), "tv", ["shell", "true"], {
      adbExecutable: "adb",
      runner: successfulRunner(mismatchCalls),
    }),
    /identity does not match/,
  );
  assert.equal(mismatchCalls.some((args) => args.join(" ").endsWith("shell true")), false);

  const failureCalls = [];
  assert.throws(
    () => guardAndRun(configuration(), "tv", ["install", "release.apk"], {
      adbExecutable: "adb",
      runner: successfulRunner(failureCalls),
    }),
    /guarded physical-device command failed/,
  );
  assert.equal(
    failureCalls.filter((args) => args.join(" ").endsWith("media_session volume --stream 3 --set 0")).length,
    2,
  );
});

test("guard rejects transport, privilege, audio-mutation, and option-injection commands", () => {
  for (const command of [
    ["reboot"],
    ["root"],
    ["connect", "host:5555"],
    ["-s", "another-device", "shell", "true"],
    ["shell", "cmd", "media_session", "volume", "--stream", "3", "--set", "5"],
    ["shell", "input", "keyevent", "KEYCODE_VOLUME_UP"],
    ["shell", "input", "keyevent", "VOLUME_UP"],
    ["shell", "input", "keyevent", "VOLUME_MUTE"],
    ["shell", "input", "keyevent", "24"],
    ["shell", "input", "keyevent", "+24"],
    ["shell", "input", "keyevent", "0024"],
    ["shell", "input", "keyevent", "25"],
    ["shell", "input", "keyevent", "164"],
    ["shell", "settings", "--user", "0", "put", "system", "volume_music", "15"],
    ["shell", "sh", "-c", "getprop ro.product.model"],
    ["shell", "getprop", "ro.product.model;reboot"],
    ["forward", "tcp:1234", "tcp:1234"],
  ]) {
    const calls = [];
    assert.throws(
      () => guardAndRun(configuration(), "tv", command, {
        adbExecutable: "adb",
        runner: successfulRunner(calls),
      }),
      /not allowed|may not mutate|outside the physical-UAT allowlist|metacharacters|read-only/,
    );
    assert.equal(calls.length, 0);
  }
});

test("enrollment discovers identity only after zero and writes the private record", () => {
  const calls = [];
  let written;
  const result = enrollTarget({
    targetName: "tv",
    deviceClass: "tv",
    serial: "100.64.0.10:37123",
    connect: true,
    targetsPath: resolve(".uat", "physical-targets.test.json"),
    replace: false,
  }, {
    adbExecutable: "adb",
    runner: successfulRunner(calls),
    writer: (path, value) => { written = { path, value }; },
  });
  assert.equal(result.volume, 0);
  assert.equal(result.manufacturer, "Google");
  assert.equal(result.model, "Havana");
  assert.equal(written.value.targets.tv.serial, "100.64.0.10:37123");
  assert.equal(written.value.targets.tv.manufacturer, "Google");
  assert.equal(written.value.targets.tv.model, "Havana");
  const firstVolumeGet = calls.findIndex((args) => args.join(" ").endsWith("media_session volume --stream 3 --get"));
  const firstIdentityRead = calls.findIndex((args) => args.join(" ").endsWith("getprop ro.product.manufacturer"));
  assert.ok(firstVolumeGet >= 0 && firstVolumeGet < firstIdentityRead);
  assert.equal(
    calls.filter((args) => args.join(" ").endsWith("media_session volume --stream 3 --get")).length,
    2,
  );
});

test("failed enrollment does not persist a target and still restores zero", () => {
  const calls = [];
  const base = successfulRunner(calls);
  let writes = 0;
  const runner = (executable, args, options) =>
    args.join(" ") === "devices -l"
      ? { status: 0, stdout: "100.64.0.10:37123\tdevice model:sdk_gphone64_x86_64 device:emu\n", stderr: "" }
      : base(executable, args, options);
  assert.throws(
    () => enrollTarget({
      targetName: "tv",
      deviceClass: "tv",
      serial: "100.64.0.10:37123",
      connect: true,
      targetsPath: resolve(".uat", "physical-targets.test.json"),
      replace: false,
    }, {
      adbExecutable: "adb",
      runner,
      writer: () => { writes += 1; },
    }),
    /emulator or virtual device/,
  );
  assert.equal(writes, 0);
  assert.equal(calls.some((args) => args.includes("media_session")), false);
});

test("guard rejects Cuttlefish and prefixed emulator descriptors before target shell commands", () => {
  for (const descriptor of [
    "product:aosp_cf_x86_64_phone model:Cuttlefish_x86_64_phone device:vsoc_x86_64",
    "product:sdk_x86_64 model:generic_x86_64 device:emu64xa",
  ]) {
    const calls = [];
    const base = successfulRunner(calls);
    const runner = (executable, args, options) =>
      args.join(" ") === "devices -l"
        ? { status: 0, stdout: `100.64.0.10:37123\tdevice ${descriptor}\n`, stderr: "" }
        : base(executable, args, options);
    assert.throws(
      () => guardAndRun(configuration(), "tv", ["shell", "true"], {
        adbExecutable: "adb",
        runner,
      }),
      /emulator or virtual device/,
    );
    assert.equal(calls.some((args) => args[0] === "-s"), false);
  }
});

test("guard attempts restoration when initial zero verification fails", () => {
  const calls = [];
  const base = successfulRunner(calls);
  let readbacks = 0;
  const runner = (executable, args, options) => {
    const joined = args.join(" ");
    if (joined.endsWith("media_session volume --stream 3 --get")) {
      calls.push(args);
      readbacks += 1;
      return readbacks === 1
        ? { status: 0, stdout: "volume is 4 in range [0..25]\n", stderr: "" }
        : { status: 0, stdout: "volume is 0 in range [0..25]\n", stderr: "" };
    }
    return base(executable, args, options);
  };
  assert.throws(
    () => guardAndRun(configuration(), "tv", ["shell", "true"], {
      adbExecutable: "adb",
      runner,
    }),
    /not numeric zero/,
  );
  assert.equal(readbacks, 2);
  assert.equal(calls.some((args) => args.join(" ").endsWith("shell true")), false);
});

test("guard fails closed when post-command zero restoration cannot be verified", () => {
  const calls = [];
  const base = successfulRunner(calls);
  let readbacks = 0;
  const runner = (executable, args, options) => {
    const joined = args.join(" ");
    if (joined.endsWith("media_session volume --stream 3 --get")) {
      calls.push(args);
      readbacks += 1;
      return readbacks === 1
        ? { status: 0, stdout: "volume is 0 in range [0..25]\n", stderr: "" }
        : { status: 0, stdout: "volume is 1 in range [0..25]\n", stderr: "" };
    }
    return base(executable, args, options);
  };
  assert.throws(
    () => guardAndRun(configuration(), "tv", ["shell", "getprop", "ro.build.version.sdk"], {
      adbExecutable: "adb",
      runner,
    }),
    /could not be re-verified/,
  );
  assert.equal(readbacks, 2);
  assert.equal(calls.some((args) => args.join(" ").endsWith("shell getprop ro.build.version.sdk")), true);
});

test("enrollment attempts restoration when initial zero verification fails", () => {
  const calls = [];
  const base = successfulRunner(calls);
  let readbacks = 0;
  let writes = 0;
  const runner = (executable, args, options) => {
    const joined = args.join(" ");
    if (joined.endsWith("media_session volume --stream 3 --get")) {
      calls.push(args);
      readbacks += 1;
      return readbacks === 1
        ? { status: 0, stdout: "volume is 2 in range [0..25]\n", stderr: "" }
        : { status: 0, stdout: "volume is 0 in range [0..25]\n", stderr: "" };
    }
    return base(executable, args, options);
  };
  assert.throws(
    () => enrollTarget({
      targetName: "tv",
      deviceClass: "tv",
      serial: "100.64.0.10:37123",
      connect: true,
      targetsPath: resolve(".uat", "physical-targets.test.json"),
      replace: false,
    }, {
      adbExecutable: "adb",
      runner,
      writer: () => { writes += 1; },
    }),
    /not numeric zero/,
  );
  assert.equal(readbacks, 2);
  assert.equal(writes, 0);
});

test("enrollment rejects private target files outside ignored .uat", () => {
  assert.throws(
    () => enrollTarget({
      targetName: "tv",
      deviceClass: "tv",
      serial: "100.64.0.10:37123",
      connect: true,
      targetsPath: resolve("physical-targets.json"),
      replace: false,
    }, {
      adbExecutable: "adb",
      runner: () => { throw new Error("runner must not be called"); },
    }),
    /must stay inside ignored \.uat/,
  );
});

test("ADB executable discovery is deterministic and fails when unavailable", () => {
  const adbName = process.platform === "win32" ? "adb.exe" : "adb";
  const expected = resolve("C:/sdk", "platform-tools", adbName);
  assert.equal(
    resolveAdbExecutable({ ANDROID_HOME: "C:/sdk", PATH: "" }, (path) => path === expected),
    expected,
  );
  assert.throws(() => resolveAdbExecutable({ PATH: "" }, () => false), /was not found/);
});
