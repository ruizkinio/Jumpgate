# Release Status

No coordinated Jumpgate release is ready as of 2026-07-30. The production Bridge is
deployed at immutable digest
`sha256:d3c5acfb4b85e517c48ba7b2d37115f1249ec7b1ad6cb315e10d3c8d2f29ceea`.
Protected run `30503289720` binds that digest to two healthy v6 Machines, public smoke,
and a GitHub-hosted OIDC deployment attestation. The Bridge is no longer an open
coordination blocker. The root currently pins these commits,
both reachable from their public branches:

| Input | Public branch | Candidate commit |
| --- | --- | --- |
| Bridge | `Jumpgate-bridge/main` | `0b0d6786673a749ce7f30769b96acef837865fea` |
| Kodi | `Jumpgate-kodi/master` | `35bf6b23f84faff14e9372abe0e6f2fcbb153617` |

## Blockers

- Kodi PR #5 (`f08bd3b0ba2e7f3eb046c3b0e36dfc3ecb69f90e`) remains a draft on a
  physical-UAT hold. A clean-history candidate with the same tree is public as
  `release/clean-history-v3` at
  `8a21c3d865c1819bc269c9be1a7260381e20bdf2`, but it has not replaced the pinned
  public candidate.
- The reproducible history audit passes Root and Bridge but reports two historical
  Trakt application credentials in Kodi's current custom ancestry. Those credentials
  must be rotated or revoked, credential-bearing custom refs must be retired, and the
  clean Kodi history must pass a fresh audit. Credential findings are not allowlisted.
- The pinned dual-ABI APKs use per-job ephemeral CI certificates. They are diagnostic
  artifacts, not stable release-signed deliverables.
- Official native Android Mobile `2.3.2` and Android TV `1.10.4` are the supported
  Stremio baselines. The candidate pins both ARM APKs for each app by official versioned
  URL, package, version code, ABI, SHA-256, and Stremio signing certificate. Static APK
  inspection confirms the required intent/result and unload paths, but physical phone
  and TV UAT must still prove lifecycle behavior and exact same-card replay.
- The Root release-audit GitHub App credentials and the Kodi stable release-signing
  credentials are not provisioned in Actions.

Release coordination can resume only after the clean Kodi candidate replaces the
credential-bearing custom history, passes the bounded audit, is stable-signed, and
passes sanitized physical ARM phone and TV UAT against the pinned native Stremio APKs.
No future Stremio release is required.

## Validation

Pull requests and pushes validate the candidate schema, gitlinks, public component
ancestry, exact successful provenance runs, required merged component changes, and exact
native Stremio APK representation. A later branch advance does not invalidate an
immutable candidate that remains reachable. Manual `require-ready` validation also
requires one stable APK signer, candidate-bound physical phone and TV evidence newer
than 30 days, content-addressed public evidence blobs, and independent verification of
the pinned Stremio APK bytes, package manifests, ABI sets, and signer. The workflow
validates only; it has no publication job.
