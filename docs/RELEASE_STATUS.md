# Release Status

Jumpgate `3.0.0` is a release candidate, not a public release. The coordinated
candidate is locked to these public component commits:

| Input | Public branch | Candidate commit |
| --- | --- | --- |
| Bridge | `Jumpgate-bridge/main` | `a2716ae68e9ce88561ed0ebc9ec1092cd20c3535` |
| Kodi | `Jumpgate-kodi/master` | `b105087fb2ec00db4576e2f4b1221f9c45acd84f` |

The Bridge is deployed at immutable image digest
`sha256:08599364f5bfdc6573bdf8e4d0e91ee4e0d7e38433e60fc993773e55dce21618`.
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
- The deterministic UAT-only VobSub provider passes live HTTPS transport and
  integrity checks against the exact merged Bridge commit. Its isolated Fly image
  is test infrastructure and is not part of the production candidate lock.
- The reproducible public-history audit in protected run `31706953795` reports zero
  unresolved findings. That run also independently verified the final Jumpgate and
  Stremio APKs, Bridge deployment provenance, live Bridge state, and current GitHub
  security state; it refused release only because physical UAT evidence is absent.
  One exact Kodi scanner false positive is narrowly allowlisted with a sanitized
  rationale and expiry; stale, unused, expired, or unresolved entries still fail the
  release gate.

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
| `arm64-v8a` | `0ffec97546bf7e946e24826cebd2f98816122f84a03cef8ad208a68d4dac312a` |
| `armeabi-v7a` | `9ff620c0d07f7dffd960a0b7620b30dfcbbdb7efcbe5e969ac719b7d643ab763` |

Both APKs use signing-certificate SHA-256
`10625572b5f34c5125b030dd5ab5fd40bdcd263d0fa8e2073ddee70435970551`.

Release validation is evidence-based and does not publish artifacts. Publication is a
separate deliberate action after every gate passes.
