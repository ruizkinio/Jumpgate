# Release Status

No coordinated Jumpgate release is ready as of 2026-07-29. The production Bridge is
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
- `@stremio/stremio-core-web` `0.60.2` and Stremio Web `development` now contain
  required core fix `46091b81ec6865fc1bb6e1d056409b78482cfc61`. The latest public Web release is
  still `v5.0.0-beta.39` with core `0.59.0`, so release validation still needs a new
  public Stremio Web tag that includes `0.60.2` or later.
- The Root release-audit GitHub App credentials and the Kodi stable release-signing
  credentials are not provisioned in Actions.

Release coordination can resume only after the clean Kodi candidate replaces the
credential-bearing custom history, passes the bounded audit, is stable-signed, and
passes sanitized physical ARM phone and TV UAT. A public Stremio release must also be
proven through its exact package, lockfile, npm provenance, and core ancestry to include
the required fix.

## Validation

Pull requests and pushes validate the candidate schema, gitlinks, public component
ancestry, exact successful provenance runs, required merged component changes, and exact
Stremio dependency representation. A later branch advance does not invalidate an
immutable candidate that remains reachable. Manual `require-ready` validation also
requires one stable APK signer, candidate-bound physical phone and TV evidence newer
than 30 days, content-addressed public evidence blobs, and a Stremio Core containing the
required fix. The workflow validates only; it has no publication job.
