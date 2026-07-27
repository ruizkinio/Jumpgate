# Architecture

## Objective

Jumpgate lets Stremio choose content and providers while Kodi performs playback. The
hard problem is not opening a URL; it is preserving exact content/profile identity,
private provider authority, subtitle integrity, local history, cloud synchronization,
and Android lifecycle behavior across two apps and a horizontally scalable service.

## Components

### Stremio

Stremio remains the catalog and source-selection UI. A private configured Jumpgate
addon imports the user's selected providers and returns compatible stream/subtitle
resources. Each returned source is associated with bounded encrypted server-side
context before Stremio launches the external player.

### Bridge

Bridge provides:

- Short-lived device pairing and durable profile/device registration.
- Read-only import of Stremio provider descriptors.
- Pinned, bounded, redirect-aware provider requests.
- Profile-scoped source contexts, fingerprints, reservations, claims, and releases.
- Local/cloud history APIs and Continue Watching projection.
- Trakt OAuth, token refresh fencing, and server-side claim-bound lifecycle dispatch.
- Private subtitle discovery, materialization, object storage, and delivery.
- PostgreSQL durable storage, Redis coordination, and immutable-image deployment.

### Jumpgate For Android

The Kodi fork provides:

- Standalone Kodi and Stremio external-player modes in the same application.
- AndroidKeyStore-backed paired profile capabilities.
- Exact-origin pairing, profile selection, and source claim/release.
- Generation-bound playback admission, replacement, terminal result, and return.
- Local resume/history independent from Trakt and Stremio synchronization.
- Authenticated claim-bound history events; Bridge alone performs optional Trakt dispatch.
- Private text/VobSub subtitle staging and normal Kodi subtitle controls.
- Jumpgate loading overlay, metadata, clearlogo cache, and text fallback.

## Pairing And Installation

Pairing uses a responsive modal dialog backed by `CJumpgatePairingCoordinator`. The
dialog remains on Kodi's process thread while a worker performs exact-origin,
redirect-free code issuance, QR rendering, interruptible polling, and transport
cancellation. The process thread consumes immutable snapshots and alone may store an
AndroidKeyStore-backed device capability or activate a profile.

The coordinator moves through `Idle`, `Issuing`, `AwaitingActivation`, `Applying`, and
`Applied`; `Cancelled`, `Expired`, and `Failed` are non-applied terminal states. The
browser activates a short-lived human code only after a profile is configured. A paired
poll response enters `Applying` and queues one-time redemption to the process thread.
The dialog closes automatically only after durable credential commit reports
`Applied`. Applying hides Cancel and consumes Back so an in-progress secure commit is
not presented as cancelled; a failed commit remains visible and can request a new code.
If playback takes profile authority before commit begins, the queued redemption is
scrubbed and the attempt becomes `Failed`; the modal dialog never waits indefinitely.

Cancellation is sticky before and after curl publication. The coordinator publishes
its stop request first, wakes timed waits, interrupts an active transport, and makes a
newly published transport observe an already-requested cancellation before I/O. Any
response returned after cancellation is scrubbed and cannot reach redemption. One
steady-clock deadline begins from the issuance response; all waits are bounded by the
remaining lifetime, an in-flight curl is cancelled by a watcher at that deadline, and
every poll response is rejected when it arrives at or after the deadline. HTTP `410`
expires the attempt. HTTP `429` keeps the current code, respects a positive `Retry-After`
bounded to 1-30 seconds and the remaining lifetime, and does not reset expiry.

The prefilled one-time verification URL is rendered to a unique temporary PNG. Its path
is fenced to one attempt and snapshot revision. Cancellation, expiry, failure, successful
apply, retry, and teardown clear the presented code/URL/path; the dialog releases the
matching GUI texture before the matching file is removed. Cleanup from an older attempt
cannot delete a replacement QR. QR rendering failure falls back to the visible URL and
human code without weakening pairing identity.

Retry is allowed only from a non-applied terminal state. It drains the old worker,
completes GUI/QR cleanup, and issues a fresh code against the same validated immutable
Bridge origin. Teardown uses the same sticky cancellation, worker drain, secret clearing,
and texture-before-file cleanup before callback owners are destroyed. Normal users never
enter a Bridge URL.

Addon generation and installation are released only after pairing and provider
import. A configured addon URL is a private profile capability. Pairing credentials
and configured addon capabilities are separate, so leaking one does not silently
become an unrestricted device credential.

Provider import uses Stremio's one-shot account-link flow in the configuration browser.
Login in the Android Stremio app is separate from browser authentication; the current
app exposes no supported approval deep link, provider-collection IPC, or delegated
export. Jumpgate keeps browser approval explicit and discards the returned account
authorization immediately after one collection read.

## Source-Backed Playback

1. Stremio requests streams through its configured Jumpgate addon.
2. Bridge requests the selected provider and validates its response.
3. Bridge stores a bounded encrypted source context and returns Stremio-compatible
   resources.
4. Stremio launches Jumpgate with the selected transport.
5. The paired device derives the shared source fingerprint and requests a claim.
6. Bridge atomically reserves the exact profile/device/session/context generation.
7. Kodi accepts canonical identity only from the authenticated claim.
8. Playback, local history, optional Trakt, and subtitles use that generation until
   terminal release.

No global lookup and no client IP participate in this sequence. A delayed claim,
subtitle, stop, or app result cannot mutate a newer playback generation.

## Unknown Content

Transport and cloud identity are intentionally separate. A direct file, M3U/M3U8,
M2TS, torrent result, or provider proxy can remain playable even when canonical title
identity is absent. In that case:

- Kodi playback proceeds.
- Local history/resume can use a non-authoritative local key.
- Trakt is not called.
- The UI can show caller metadata or an identifying fallback, but it cannot promote
  that metadata to authenticated identity.

This avoids both false scrobbles and needless playback failures.

## History

On-device history is authoritative for Jumpgate playback continuity. Bridge history
provides profile-scoped synchronization and Continue Watching projection. Trakt and
Stremio result return are optional external synchronization targets.

History updates use canonical immutable identity plus bounded compare-and-swap
retries. Completion can be cleared by meaningful replay, removals remain internal
tombstones with monotonic change sequences, and public reads hide tombstones. Plain
history snapshots never store source URLs, cookies, headers, or provider credentials.

Android sends bounded `start`, `progress`, `pause`, `background`, `resume`, `stop`,
and `completion` events with a claim-issued history grant and idempotency key. Watched
time advances only when both monotonic time and Kodi's media clock advance plausibly;
pause, background, stalls, seeks, and clock discontinuities earn no credit. A claim is
released with a terminal receipt only after Bridge accepts the matching terminal event.

## Trakt

Bridge owns browser OAuth, access and refresh credentials, refresh fencing, and Trakt
network dispatch. Kodi receives no Trakt token or client credential; it sends only
authenticated claim-bound history events. Bridge dispatch requires the exact active
canonical claim, canonical history grant, eligible session generation/revision, and
authoritative server-side OAuth state.

Lifecycle events are generation-bound. Periodic progress is suppressed while playback
is paused or backgrounded, so Bridge cannot keep Trakt in a watching state from stale
activity. Ambiguous refresh outcomes require reauthorization rather than replaying a
possibly rotated token.

## Subtitles

Public Stremio subtitle behavior remains unchanged. For private Jumpgate delivery:

1. Kodi discovers candidates for the active claim.
2. Bridge returns bounded selectors, not raw provider URLs.
3. The selected candidate is materialized into private object storage.
4. Kodi negotiates checksum schema v2 and downloads bounded identity-encoded parts.
5. SHA-256 is verified before secure staging.
6. Text files or complete VobSub IDX/SUB pairs replace the previous generation
   atomically and are injected through Kodi's normal subtitle path.

Cancellation, retries, playback replacement, delayed writes, startup orphan cleanup,
and player-read lifetime are explicitly fenced.

## Storage And Scaling

Production replicas share:

- PostgreSQL for profiles, devices, provider descriptors, OAuth, history, aliases,
  backups, and migration state.
- Redis for pairing, claims, playback context, generations, leases, quotas, rate
  limits, and subtitle delivery coordination.
- Private S3-compatible storage for subtitle objects and readiness canaries.
- Stable, purpose-separated configuration encryption, token pepper, envelope keyring,
  and object-key authority.

Production startup and readiness fail closed when these protocols are unavailable or
misconfigured. Tenant capacity pressure may reject new work or evict only the same
profile's oldest TTL state; one profile cannot evict another profile's authority.

## Deployment

Bridge CI tests Node behavior, live Redis, live PostgreSQL, Bridge/Kodi fingerprint
parity, and the exact production image with isolated protocol harnesses. The image is
built once and deployed by immutable digest through a protected environment. Rolling
Machine updates retain leases, validate topology and health, and roll back exact prior
configuration on failure.

Kodi CI builds `arm64-v8a` and `armeabi-v7a` APKs with pinned Android/JDK inputs,
ephemeral CI signing, static native symbol checks, and post-build package/ABI/signer/
secret verification. Pairing coordinator/presenter/QR tests cover state, cancellation,
deadline, rate-limit, secure-commit, retry, teardown, and artifact ownership, while APK
verification confirms the native dialog XML/media in both ABIs. Device UAT remains
mandatory because CI cannot prove modal responsiveness, remote focus, GUI texture/file
ordering, or Stremio's external-player lifecycle.
