# Release Status

Jumpgate `3.0.0` is a release candidate, not a public release. The coordinated
candidate is locked to these public component commits:

| Input | Public branch | Candidate commit |
| --- | --- | --- |
| Bridge | `Jumpgate-bridge/main` | `1a37c36095cbd933af955936928ac3fd370e8206` |
| Kodi | `Jumpgate-kodi/master` | `9cd5a416595825dccff0ac6f107f7217b9744e5e` |

The Bridge is deployed at immutable image digest
`sha256:7d6c712efebdfcdf0c2d5136d5fb4cfe998f81a0e86d41b0536fd7a352498319`.
Protected deployment provenance and live health checks pass for that digest.

Kodi's protected stable release workflow produced signed `arm64-v8a` and
`armeabi-v7a` APKs with one signer. Draft release `v3.0.0` remains unpublished until
physical UAT passes.

## Completed Gates

- Root candidate metadata, gitlinks, public ancestry, component workflow provenance,
  artifact identities, and pinned native Stremio APK identities pass protected and
  independent validation.
- Bridge deployment attestation, live image digest, `/health/live`, `/health/ready`,
  and `/version` pass.
- Kodi host tests and both Android ABI builds pass protected CI.
- The reproducible public-history audit in protected run `31677146399` reports zero
  unresolved findings. One exact Kodi scanner false positive is narrowly allowlisted
  with a sanitized rationale and expiry; stale, unused, expired, or unresolved entries
  still fail the release gate.

## Remaining Blocker

Sanitized physical UAT is still required on one ARM phone and one ARM TV using the
exact locked Jumpgate and Stremio APKs. Every case in `docs/UAT.md` must pass without
force-closing either app, manually copying a Bridge URL into Kodi, guessing content
identity, or fabricating unavailable provider results.

The physical reports must prove pairing, provider import, canonical and local-only
identity, local history, Trakt, subtitles, external-player lifecycle, Back/result
delivery, completion, exact same-card replay, profile isolation, and standalone Kodi.
Until both immutable sanitized reports are committed and protected
`--require-ready` validation passes, the draft release must remain private.

## Locked Artifacts

| ABI | APK SHA-256 |
| --- | --- |
| `arm64-v8a` | `5e1f43083d2a0fdd9e858131f2197c9af984114909cac0ad8432c6ba6ecb9c7e` |
| `armeabi-v7a` | `f30a7edfccaa7b70f2c915f747856a2e619396e005b41cbbd93ed8a66150c798` |

Both APKs use signing-certificate SHA-256
`10625572b5f34c5125b030dd5ab5fd40bdcd263d0fa8e2073ddee70435970551`.

Release validation is evidence-based and does not publish artifacts. Publication is a
separate deliberate action after every gate passes.
