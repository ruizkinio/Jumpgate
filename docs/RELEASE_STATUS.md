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
  physical-UAT hold. It is not merged into the pinned public candidate.
- The pinned dual-ABI APKs use per-job ephemeral CI certificates. They are diagnostic
  artifacts, not stable release-signed deliverables.
- The latest public Stremio Web release, `v5.0.0-beta.39`, pins
  `@stremio/stremio-core-web` `0.59.0` in both `package.json` and
  `pnpm-lock.yaml`. That package identifies core commit
  `90c38f181d290fc705049e4c8bd30df00f6f3e66`, which does not contain required
  core fix `46091b81ec6865fc1bb6e1d056409b78482cfc61`.

Release coordination can resume only after PR #5 passes sanitized physical ARM phone
and TV UAT and is merged, the resulting dual-ABI APKs are signed by one stable release
certificate, and a public Stremio release is proven through its exact package, lockfile,
npm provenance, and core ancestry to include the required fix. Security-alert and
bounded secret/history audits also remain required before publication.

## Validation

Pull requests and pushes validate the candidate schema, gitlinks, public component
ancestry, exact successful provenance runs, required merged component changes, and exact
Stremio dependency representation. A later branch advance does not invalidate an
immutable candidate that remains reachable. Manual `require-ready` validation also
requires one stable APK signer, candidate-bound physical phone and TV evidence newer
than 30 days, content-addressed public evidence blobs, and a Stremio Core containing the
required fix. The workflow validates only; it has no publication job.
