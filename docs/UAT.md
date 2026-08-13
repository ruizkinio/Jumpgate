# Device UAT

This protocol is required before a coordinated Jumpgate release. Record exact build
SHAs, APK hashes, signer fingerprint, Bridge image digest, device model/API/ABI,
Stremio version, provider class, and pass/fail result. Never record private URLs,
tokens, headers, cookies, provider responses, account names, or pairing codes.

## Release Inputs

- Bridge commit and immutable image digest match the protected CI run.
- `/health/live`, `/health/ready`, and `/version` pass on the deployed origin.
- Kodi and Bridge commits are reachable from their configured public branches and match
  the coordination candidate gitlinks.
- APK package, version, ABI, SHA-256, and signer match the verifier output.
- For package-override diagnostics, the manifest/application ID, generated Java package,
  and native `CCompileInfo::GetPackage()` value are identical to the requested package.
- The APK native ABI matches the device ABI. ABI-translated emulator runs are diagnostic
  only and cannot satisfy playback stability or lifecycle gates.
- Stremio is signed into a dedicated test account on the target device.
- Trakt and TMDB test accounts/keys contain no unrelated private history.

Use `npm run uat:device -- run` for every ADB operation. The wrapper reads an ignored
`.uat/physical-targets.json`, refuses emulator/QEMU/loopback targets, sets Android media
stream `3` to numeric `0`, verifies an unambiguous numeric `0` readback before running
the requested command, and restores and re-verifies `0` afterward. A missing or failed
readback blocks the operation; mute state is not evidence of numeric volume `0`.

Enroll each physical target through the same guard. This first sets and verifies numeric
media volume `0`, rejects virtual-device descriptors and properties, reads the exact
manufacturer/model, restores and re-verifies `0`, then atomically writes the ignored
private file. Use `--connect` for wireless ADB serials and `--replace` only when updating
an existing named target:

```bash
npm run uat:device -- enroll --target phone --device-class phone \
  --serial PRIVATE_ADB_SERIAL --connect
```

Run one bounded device operation at a time so every operation crosses the guard:

```bash
npm run uat:device -- run --target phone -- shell getprop ro.build.version.sdk
```

The wrapper accepts only documented UAT-relevant ADB operation and shell-command
families. Shell interpreters, metacharacters, transport changes, privilege changes,
reboots, and direct audio mutations are refused. Extend the reviewed allowlist and its
tests when a release case genuinely requires another operation; do not bypass the guard.

Every bracketed case below is required on both physical device classes unless it is
explicitly labeled **TV only**. TV-only cases are omitted from the phone workbook and
must pass in the TV workbook; there is no operator-selected `N/A` status or applicability
override. The strict phone/TV case-set union must cover this complete protocol.

## Installation And Pairing

1. [`installation-and-pairing/install-verified-apk`] Install the verified APK without
   clearing unrelated app/device data.
2. [`installation-and-pairing/standalone-first-launch`] Launch Jumpgate in standalone
   mode and confirm normal Kodi startup/navigation.
3. [`installation-and-pairing/manager-entrypoints`] Open Jumpgate Manager. Confirm Open
   and Configure lead to the settings page and
   **Open Native Manager** opens the native profile UI.
4. [`installation-and-pairing/delayed-ui-responsive`] Select **Pair New Profile** with
   delayed Bridge responses. Confirm the modal dialog
   continues to render status/countdown changes and accepts TV remote, touch, and Back/
   Cancel input without freezing Kodi's process thread.
5. [`installation-and-pairing/code-forms-profile-bound`] In separate attempts, scan the
   QR and enter both hyphenated and compact code forms.
   Confirm each reaches only the intended profile. Do not retain the QR, code, private
   URL, account/profile name, or temporary path in evidence.
6. [`installation-and-pairing/cancel-race-matrix`] Cancel immediately after opening,
   during delayed code issuance, during the countdown
   wait, and during a delayed token poll. Each cancellation must close promptly, produce
   no credential/profile mutation or later success notification, and permit a fresh
   attempt without force-closing Jumpgate.
7. [`installation-and-pairing/expiry-boundary`] Use a short-lived test code and hold a
   poll response across its deadline. Confirm the
   countdown reaches zero exactly, the late response is rejected, code/URL/QR presentation
   clears, HTTP `410` produces the same expired state, and the old code cannot be revived.
8. [`installation-and-pairing/rate-limit-deadline`] Return HTTP `429` with a positive
   `Retry-After`. Confirm the same code remains visible,
   no poll occurs before the bounded delay, the countdown continues, and rate limiting
   does not extend expiry. Confirm transient transport recovery also remains within the
   original deadline and does not busy-loop.
9. [`installation-and-pairing/retry-generation-isolation`] From `Expired` and injected
   non-commit `Failed` states, choose **Request New Code**.
   Confirm the old worker and QR are gone before a different code/QR appears, the validated
   Bridge origin is unchanged, and no old response can update the replacement attempt.
10. [`installation-and-pairing/secure-commit`] Activate a valid code while delaying local
    credential commit. Confirm the dialog
    enters Applying, hides Cancel, consumes Back, and remains open. Successful durable
    commit must then close it automatically and report **Paired and applied** without an
    extra confirmation dialog; failed commit must remain visible and retryable. In a
    separate attempt, start playback after browser activation but before local commit;
    confirm redemption is scrubbed and the dialog becomes Failed instead of hanging.
11. [`installation-and-pairing/qr-artifact-lifecycle`] After cancellation, expiry,
    failure, retry replacement, successful apply, and app/
    Activity teardown, confirm the GUI no longer references the QR before its temporary
    PNG disappears. No stale pairing PNG, stale QR, rendering error, or cleanup of a newer
    attempt is allowed.
12. [`installation-and-pairing/activity-teardown`] Background/foreground and
    destroy/reopen Jumpgate during issuance and polling.
    Confirm sticky cancellation interrupts the published or subsequently published curl,
    workers drain before callback owners disappear, secrets clear, and pairing can restart
    without a stale status or force-close workaround.
13. [`installation-and-pairing/browser-account-link`] Confirm Android Stremio login alone
    does not falsely satisfy the separate browser
    account-link gate. Approve in the configuration browser, verify the account key is
    discarded after one collection read, connect optional Trakt/TMDB, import providers,
    then install the generated addon in the signed-in Stremio profile.
14. [`installation-and-pairing/install-gated-before-ready`] Confirm install actions remain
    unavailable before pairing and provider import.
15. [`installation-and-pairing/stremio-result-contract`] Record the exact public Stremio
    package, version name/code, ABI, APK SHA-256, and signing-certificate SHA-256. These
    values must match the device-class and ABI-specific candidate artifact. For supported
    Android Mobile `2.3.2` and Android TV `1.10.4`, inspect
    the native APK and runtime launch to confirm the normal external-player path remains an
    implicit package-less `ACTION_VIEW` with the selected URI, MIME `video/*`, and
    activity-result contract. Confirm player-screen disposal calls
    `PlayerViewModel.unload()` and clears the Core Player field. Exercise representative
    HTTP(S), playlist, and other supported transport schemes; each must resolve Jumpgate,
    while Android may keep separate scheme-scoped preferences. Using a sanitized
    development fixture only, confirm Stremio's explicit `externalUrl`/package path does
    not provide that result contract and therefore remains unsupported. Android Mobile
    `2.1.5` is unsupported. Any Stremio package/version, lifecycle, or intent-shape change
    blocks release until this gate and result-bound resume/completion/lifecycle tests pass
    again.
16. [`installation-and-pairing/android-player-defaults`] Set Stremio **Settings > Playback
    > Default player** to **External player**. With
    stock Kodi also installed and no preferred media app, confirm Android lists distinct
    **Jumpgate** and **Kodi** targets. Select Kodi with **Always** for one representative
    video intent, confirm a subsequent matching intent can suppress the chooser, then clear
    only Kodi's Android **Open by default**/**Set as default** selection without clearing
    either app's data. Launch again, select Jumpgate with **Just once**, and confirm the
    result lifecycle. Optionally select Jumpgate with **Always** and confirm only matching
    intents route directly; a different scheme may prompt again and matching intents from
    another app may also route to Jumpgate. Switching Stremio to an internal player and
    back must not be treated as clearing Android's preferred activity.

## Standalone Kodi

- [`standalone-kodi/upstream-behavior`] Local files, network sources, normal Kodi library
  playback, skins, settings,
  subtitle addons, OSD, and Back navigation behave like upstream Kodi.
- [`standalone-kodi/external-back-inactive`] Jumpgate external-player Back interception is
  inactive.
- [`standalone-kodi/profile-selection-inert`] Paired and unpaired profile selection does
  not start playback or Trakt activity.
- [`standalone-kodi/catalog-browse-inert`] Launching Stremio or browsing a catalog does
  not mark anything as watching.

## Provider Matrix

Test at least one valid result from each available class:

- [`provider-matrix/aggregator`] AIOStreams or equivalent aggregator.
- [`provider-matrix/debrid`] DMM or equivalent debrid source.
- [`provider-matrix/direct-http`] Direct HTTP(S) video.
- [`provider-matrix/playlist`] M3U/M3U8 playlist transport.
- [`provider-matrix/non-mkv-container`] M2TS or other non-MKV container.
- [`provider-matrix/torrent`] Torrent-backed result.
- [`provider-matrix/signed-redirect`] Provider-proxied/signed URL with bounded redirects.
- [`provider-matrix/subtitle-text`] Text subtitle provider.
- [`provider-matrix/subtitle-ass`] ASS/SSA subtitle provider.
- [`provider-matrix/subtitle-vobsub`] VobSub archive source when available.

For each source, record whether canonical identity was claimed. Transport success and
identity success are separate results.

## Identity

- [`identity/canonical-exact`] A canonical provider result claims the exact expected
  film/episode and profile.
- [`identity/cross-provider-canonical`] The same title from two providers produces the
  same canonical history identity but
  retains source-specific transport authority.
- [`identity/unknown-local-history`] An intentionally unknown/direct source still plays
  and writes local resume/history.
- [`identity/unknown-zero-trakt`] Unknown content makes zero Trakt calls and never
  inherits the previous title.
- [`identity/no-heuristic-promotion`] Filename, URL, artwork, torrent hash, subtitle hash,
  and IP changes cannot promote
  unknown playback to canonical identity.
- [`identity/profile-nat-isolation`] Shared NAT/profile switching cannot expose another
  profile's claim or history.

## Lifecycle

For canonical and local-only playback:

1. [`lifecycle/start-first-frames`] Start and wait for first rendered frames.
2. [`lifecycle/pause-periodic-interval`] Pause long enough to cross periodic update
   intervals.
3. [`lifecycle/background-foreground`] Background and foreground both apps.
4. [`lifecycle/resume`] Resume playback.
5. [`lifecycle/seek`] Seek backward and forward.
6. [`lifecycle/back-result`] Dismiss the OSD with Back, then return to Stremio with the
   next Back.
7. **TV only.** [`lifecycle/stremio-tv-premium-profile-return`] On Android TV `1.10.4` with a Premium
   multi-profile account, record whether Stremio shows **Who's watching?** after the
   return. If it does, select the same profile without restarting either app. This is
   tracked upstream as `Stremio/stremio-bugs#2708` and does not waive any result, task,
   history, or replay requirement.
8. [`lifecycle/repeat-launch`] Immediately select the exact same cached stream card again.
   Confirm Stremio performs a fresh Player load and invokes Jumpgate a second time without
   a Bridge refresh, app restart, or force-close workaround. Then return and start a
   structurally different source without force-closing either app.
9. [`lifecycle/replacement-race`] Rapidly replace source A with B while A still has pending
   metadata/subtitles.
10. [`lifecycle/completion-threshold`] Stop below completion threshold, then replay and
   complete above the threshold.

Pass conditions:

- [`lifecycle/no-stuck-ui-or-crash`] No black screen, infinite Stremio spinner, Kodi
  home-screen leak, process crash, or
  stale loading overlay.
- [`lifecycle/exact-result-delivery`] Each external launch returns exactly one result to
  the correct Stremio task.
- [`lifecycle/stale-callback-fence`] Delayed callbacks from A cannot alter B.
- [`lifecycle/local-resume-restart`] Local resume position and completion are correct after
  process restart.
- [`lifecycle/standalone-after-external`] Standalone mode remains unaffected after
  external-player use.
- **TV only.** [`lifecycle/stremio-tv-premium-profile-picker-boundary`] The Android TV `1.10.4`
  Premium profile picker is accepted only when the pinned Stremio APK and same process
  are proven, Jumpgate's exact terminal result and local history are durable, its
  external task exits, and same-card replay passes after reselecting the profile. It
  cannot excuse a spinner, missing result, stale task, or force-close workaround.

## Trakt

Use Trakt's account activity and sanitized device logs to verify:

- [`trakt/no-event-before-claim`] No event before canonical claim acceptance.
- [`trakt/start-once`] Start occurs once when playback becomes meaningful.
- [`trakt/pause-suppresses-periodic`] Pause suppresses periodic start updates.
- [`trakt/resume-no-duplicate`] Resume restarts watching without duplicate generations.
- [`trakt/stop-identity-token-consistency`] Stop/completion use the same canonical identity
  and token/client-ID pair as start.
- [`trakt/background-paused`] Backgrounding while paused cannot return the title to
  watching.
- [`trakt/replacement-ordering`] Rapid replacement stops A before or independently from
  starting B, without identity
  crossover.
- [`trakt/reauthorization-fail-closed`] Expired/revoked authorization requests
  reauthorization and never falls back to
  embedded or title-search credentials.

## Subtitles

- [`subtitles/text-ass-fidelity`] Text and ASS/SSA content retains expected text, timing,
  encoding, and styling.
- [`subtitles/vobsub-atomic-pair`] VobSub publishes a complete matching IDX/SUB pair before
  Kodi injection.
- [`subtitles/picker-controls`] Subtitle picker, enable/disable, language selection, and
  delay controls work.
- [`subtitles/replacement-generation`] Replacing a subtitle removes the previous generation
  only after player safety.
- [`subtitles/playback-replacement-cancel`] Playback replacement cancels stale discovery/
  download/staging.
- [`subtitles/integrity-failures`] Digest mismatch, oversized payload, redirect, range,
  encoding, missing part, and
  expiry failures do not inject partial content.
- [`subtitles/kodi-addon-compatibility`] Existing Kodi subtitle addons remain usable when
  Bridge subtitles are disabled or
  no Bridge candidate is selected.

## Overlay And Remote Control

- [`overlay-and-remote-control/canonical-display`] Overlay shows canonical title/metadata
  rather than a transport URL or token.
- [`overlay-and-remote-control/clearlogo-fallback`] Clearlogo appears from the approved
  TMDB host when available and cached; text is the
  fallback when unavailable.
- [`overlay-and-remote-control/bounded-cache`] Repeat playback uses the bounded cache
  without unbounded storage growth.
- [`overlay-and-remote-control/back-semantics`] First Back hides visible OSD; next Back
  returns to Stremio in external mode.
- [`overlay-and-remote-control/input-task-isolation`] Long-press, TV remote, Android
  navigation, and phone gestures do not terminate the
  wrong task or enter Kodi home in external mode.

## Profiles

- [`profiles/two-profile-switch`] Pair at least two profiles and switch them in standalone
  mode.
- [`profiles/addon-authority-isolation`] Each configured addon uses only its matching
  profile/device authority.
- [`profiles/removal-isolation`] Removing one profile preserves the other profile's
  credentials/history.
- [`profiles/no-exact-profile-local-only`] A launch with no exact profile remains
  local-only instead of selecting by IP or most
  recent profile.
- [`profiles/repair-history-boundary`] Re-pair/repair preserves protected history only
  when the exact profile boundary is
  proven.

## Evidence And Sign-Off

Release evidence must include:

- Green protected Bridge and dual-ABI Android CI URLs.
- Deployed Bridge digest/readiness/version output with secrets absent.
- APK SHA-256, package/version/ABI, and signer fingerprint.
- One stable release signer across both ABI artifacts; ephemeral CI certificates cannot
  satisfy release evidence.
- Sanitized result table for every scenario above.
- Sanitized pairing matrix recording device/build, phase, injected condition, bounded
  elapsed-time result, terminal state, profile-mutation result, and QR-artifact result;
  never record codes, QR images, private URLs/paths, responses, tokens, or profile names.
- Known provider-specific limitations that do not violate identity/privacy/lifecycle
  invariants.
- Confirmation that current trees and bounded clean release histories pass the documented
  secret and security-alert audits.

Any frozen pairing dialog, post-cancel profile mutation, redemption accepted at/after
expiry, premature close before secure commit, stale QR file/texture, or workaround that
requires force-closing Stremio/Kodi, manually copying a Bridge URL into Kodi, guessing
identity, disabling profile isolation, weakening production storage, or bypassing
subtitle integrity is a release failure, not a documented fix.
