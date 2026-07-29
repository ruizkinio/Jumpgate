# Changelog

All notable Jumpgate changes are recorded here. Jumpgate follows semantic versioning
for coordinated public releases; Kodi's upstream engine version remains visible in
the Android package metadata.

## [Unreleased]

### Added

- Paired, profile-scoped Stremio provider import and arbitrary stream/subtitle addon
  gatewaying.
- Deterministic source-context claims that bind playback to the selected provider
  response without IP, filename, title, artwork, or hash guessing.
- Local resume/history with optional canonical Trakt synchronization.
- Private, integrity-checked text and VobSub subtitle delivery while preserving Kodi
  subtitle addons, controls, and skins.
- PostgreSQL durability, Redis coordination, private S3-compatible subtitle storage,
  health/readiness checks, and immutable-image Fly deployment gates.
- Dual-ABI Android CI, source-fingerprint parity checks, adversarial APK scanning,
  and the public device UAT protocol.

### Changed

- The Android application is branded Jumpgate and uses the independent package ID
  `io.github.ruizkinio.jumpgate`, allowing it to coexist with official Kodi.
- External-player Back returns to Stremio after dismissing an open OSD; standalone
  Jumpgate retains normal Kodi navigation.
- Trakt authorization is managed by the paired Bridge profile. Kodi no longer embeds
  a Trakt client secret, stores plaintext OAuth credentials, or searches Trakt from
  guessed titles.
- Normal setup pairs Jumpgate before installing the generated private Stremio addon;
  users do not copy a Bridge URL into Kodi.

### Removed

- IP-based profile/content correlation and global fallback matching.
- Trakt authorization from URL/title/filename/artwork guesses.
- Legacy encoded-upstream wrapper routes and the misleading quick-install path.

### Release Gates

- Target coordinated version: `3.0.0`.
- The production Bridge is deployed at an immutable audited digest. Public release
  remains blocked until representative provider/subtitle and repeated external-player
  lifecycle UAT, stable APK signing, both ABI artifact audits, security triage, and clean
  public repository candidates are complete.

[Unreleased]: https://github.com/ruizkinio/Jumpgate/commits/main
