# Device UAT

This protocol is required before a coordinated Jumpgate release. Record exact build
SHAs, APK hashes, signer fingerprint, Bridge image digest, device model/API/ABI,
Stremio version, provider class, and pass/fail result. Never record private URLs,
tokens, headers, cookies, provider responses, account names, or pairing codes.

## Release Inputs

- Bridge commit and immutable image digest match the protected CI run.
- `/health/live`, `/health/ready`, and `/version` pass on the deployed origin.
- Kodi commit matches the Bridge fingerprint pin.
- APK package, version, ABI, SHA-256, and signer match the verifier output.
- For package-override diagnostics, the manifest/application ID, generated Java package,
  and native `CCompileInfo::GetPackage()` value are identical to the requested package.
- The APK native ABI matches the device ABI. ABI-translated emulator runs are diagnostic
  only and cannot satisfy playback stability or lifecycle gates.
- Stremio is signed into a dedicated test account on the target device.
- Trakt and TMDB test accounts/keys contain no unrelated private history.

## Installation And Pairing

1. Install the verified APK without clearing unrelated app/device data.
2. Launch Jumpgate in standalone mode and confirm normal Kodi startup/navigation.
3. Open Jumpgate Manager. Confirm Open and Configure lead to the settings page and
   **Open Native Manager** opens the native profile UI.
4. Select **Pair New Profile** with delayed Bridge responses. Confirm the modal dialog
   continues to render status/countdown changes and accepts TV remote, touch, and Back/
   Cancel input without freezing Kodi's process thread.
5. In separate attempts, scan the QR and enter both hyphenated and compact code forms.
   Confirm each reaches only the intended profile. Do not retain the QR, code, private
   URL, account/profile name, or temporary path in evidence.
6. Cancel immediately after opening, during delayed code issuance, during the countdown
   wait, and during a delayed token poll. Each cancellation must close promptly, produce
   no credential/profile mutation or later success notification, and permit a fresh
   attempt without force-closing Jumpgate.
7. Use a short-lived test code and hold a poll response across its deadline. Confirm the
   countdown reaches zero exactly, the late response is rejected, code/URL/QR presentation
   clears, HTTP `410` produces the same expired state, and the old code cannot be revived.
8. Return HTTP `429` with a positive `Retry-After`. Confirm the same code remains visible,
   no poll occurs before the bounded delay, the countdown continues, and rate limiting
   does not extend expiry. Confirm transient transport recovery also remains within the
   original deadline and does not busy-loop.
9. From `Expired` and injected non-commit `Failed` states, choose **Request New Code**.
   Confirm the old worker and QR are gone before a different code/QR appears, the validated
   Bridge origin is unchanged, and no old response can update the replacement attempt.
10. Activate a valid code while delaying local credential commit. Confirm the dialog
    enters Applying, hides Cancel, consumes Back, and remains open. Successful durable
    commit must then close it automatically and report **Paired and applied** without an
    extra confirmation dialog; failed commit must remain visible and retryable. In a
    separate attempt, start playback after browser activation but before local commit;
    confirm redemption is scrubbed and the dialog becomes Failed instead of hanging.
11. After cancellation, expiry, failure, retry replacement, successful apply, and app/
    Activity teardown, confirm the GUI no longer references the QR before its temporary
    PNG disappears. No stale pairing PNG, stale QR, rendering error, or cleanup of a newer
    attempt is allowed.
12. Background/foreground and destroy/reopen Jumpgate during issuance and polling.
    Confirm sticky cancellation interrupts the published or subsequently published curl,
    workers drain before callback owners disappear, secrets clear, and pairing can restart
    without a stale status or force-close workaround.
13. Confirm Android Stremio login alone does not falsely satisfy the separate browser
    account-link gate. Approve in the configuration browser, verify the account key is
    discarded after one collection read, connect optional Trakt/TMDB, import providers,
    then install the generated addon in the signed-in Stremio profile.
14. Confirm install actions remain unavailable before pairing and provider import.
15. Record the exact Stremio package/version. For supported `2.1.5`, inspect the APK and
    runtime launch to confirm the normal external-player path remains an implicit
    package-less `ACTION_VIEW` with the selected URI, MIME `video/*`, and activity-result
    contract. Exercise representative HTTP(S), playlist, and other supported transport
    schemes; each must resolve Jumpgate, while Android may keep separate scheme-scoped
    preferences. Using a sanitized development fixture only, confirm Stremio's explicit
    `externalUrl`/package path does not provide that result contract and therefore remains
    unsupported. Any Stremio version or intent-shape change blocks release until this gate
    and result-bound resume/completion/lifecycle tests pass again.
16. Set Stremio **Settings > Playback > Default player** to **External player**. With
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

- Local files, network sources, normal Kodi library playback, skins, settings,
  subtitle addons, OSD, and Back navigation behave like upstream Kodi.
- Jumpgate external-player Back interception is inactive.
- Paired and unpaired profile selection does not start playback or Trakt activity.
- Launching Stremio or browsing a catalog does not mark anything as watching.

## Provider Matrix

Test at least one valid result from each available class:

- AIOStreams or equivalent aggregator.
- DMM or equivalent debrid source.
- Direct HTTP(S) video.
- M3U/M3U8 playlist transport.
- M2TS or other non-MKV container.
- Torrent-backed result.
- Provider-proxied/signed URL with bounded redirects.
- Text subtitle provider.
- ASS/SSA subtitle provider.
- VobSub archive source when available.

For each source, record whether canonical identity was claimed. Transport success and
identity success are separate results.

## Identity

- A canonical provider result claims the exact expected film/episode and profile.
- The same title from two providers produces the same canonical history identity but
  retains source-specific transport authority.
- An intentionally unknown/direct source still plays and writes local resume/history.
- Unknown content makes zero Trakt calls and never inherits the previous title.
- Filename, URL, artwork, torrent hash, subtitle hash, and IP changes cannot promote
  unknown playback to canonical identity.
- Shared NAT/profile switching cannot expose another profile's claim or history.

## Lifecycle

For canonical and local-only playback:

1. Start and wait for first rendered frames.
2. Pause long enough to cross periodic update intervals.
3. Background and foreground both apps.
4. Resume playback.
5. Seek backward and forward.
6. Dismiss the OSD with Back, then return to Stremio with the next Back.
7. Immediately start another source without force-closing either app.
8. Rapidly replace source A with B while A still has pending metadata/subtitles.
9. Stop below completion threshold, then replay and complete above the threshold.

Pass conditions:

- No black screen, infinite Stremio spinner, Kodi home-screen leak, emulator crash, or
  stale loading overlay.
- Each external launch returns exactly one result to the correct Stremio task.
- Delayed callbacks from A cannot alter B.
- Local resume position and completion are correct after process restart.
- Standalone mode remains unaffected after external-player use.

## Trakt

Use Trakt's account activity and sanitized device logs to verify:

- No event before canonical claim acceptance.
- Start occurs once when playback becomes meaningful.
- Pause suppresses periodic start updates.
- Resume restarts watching without duplicate generations.
- Stop/completion use the same canonical identity and token/client-ID pair as start.
- Backgrounding while paused cannot return the title to watching.
- Rapid replacement stops A before or independently from starting B, without identity
  crossover.
- Expired/revoked authorization requests reauthorization and never falls back to
  embedded or title-search credentials.

## Subtitles

- Text and ASS/SSA content retains expected text, timing, encoding, and styling.
- VobSub publishes a complete matching IDX/SUB pair before Kodi injection.
- Subtitle picker, enable/disable, language selection, and delay controls work.
- Replacing a subtitle removes the previous generation only after player safety.
- Playback replacement cancels stale discovery/download/staging.
- Digest mismatch, oversized payload, redirect, range, encoding, missing part, and
  expiry failures do not inject partial content.
- Existing Kodi subtitle addons remain usable when Bridge subtitles are disabled or
  no Bridge candidate is selected.

## Overlay And Remote Control

- Overlay shows canonical title/metadata rather than a transport URL or token.
- Clearlogo appears from the approved TMDB host when available and cached; text is the
  fallback when unavailable.
- Repeat playback uses the bounded cache without unbounded storage growth.
- First Back hides visible OSD; next Back returns to Stremio in external mode.
- Long-press, TV remote, Android navigation, and phone gestures do not terminate the
  wrong task or enter Kodi home in external mode.

## Profiles

- Pair at least two profiles and switch them in standalone mode.
- Each configured addon uses only its matching profile/device authority.
- Removing one profile preserves the other profile's credentials/history.
- A launch with no exact profile remains local-only instead of selecting by IP or most
  recent profile.
- Re-pair/repair preserves protected history only when the exact profile boundary is
  proven.

## Evidence And Sign-Off

Release evidence must include:

- Green protected Bridge and dual-ABI Android CI URLs.
- Deployed Bridge digest/readiness/version output with secrets absent.
- APK SHA-256, package/version/ABI, and signer fingerprint.
- Sanitized result table for every scenario above.
- Sanitized pairing matrix recording device/build, phase, injected condition, bounded
  elapsed-time result, terminal state, profile-mutation result, and QR-artifact result;
  never record codes, QR images, private URLs/paths, responses, tokens, or profile names.
- Known provider-specific limitations that do not violate identity/privacy/lifecycle
  invariants.
- Confirmation that current trees and clean release histories pass gitleaks.

Any frozen pairing dialog, post-cancel profile mutation, redemption accepted at/after
expiry, premature close before secure commit, stale QR file/texture, or workaround that
requires force-closing Stremio/Kodi, manually copying a Bridge URL into Kodi, guessing
identity, disabling profile isolation, weakening production storage, or bypassing
subtitle integrity is a release failure, not a documented fix.
