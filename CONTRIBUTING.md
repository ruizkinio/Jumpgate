# Contributing

Jumpgate changes span a Kodi fork, Bridge service, Android lifecycle, and hosted
provider boundary. Correctness, privacy, and reproducibility take priority over small
patch size or quick compatibility guesses.

## Workflow

1. Open or reference an issue for behavior changes and security-sensitive work.
2. Create a focused feature branch and use a Git worktree when parallel work would
   otherwise mix concerns.
3. Preserve upstream Kodi behavior outside Jumpgate external-player mode.
4. Add tests at the narrowest layer that proves the behavior, plus integration or
   device evidence when the change crosses process boundaries.
5. Run the relevant local gates and push scoped, reviewable commits.
6. Open a pull request with risk analysis, test evidence, privacy impact, and UAT
   instructions. Merge only through protected branches after required checks pass.

Do not develop releases directly on `main` or `master`, force-push protected branches,
or combine unrelated user/worktree changes into a commit.

## Required Invariants

- Never authorize Trakt from title, filename, URL, artwork, IP address, or hash
  heuristics.
- Never make unknown identity block local playback or local history.
- Never expose provider credentials or raw private source context to Kodi, Stremio,
  logs, claims, or public APIs when an opaque reference is sufficient.
- Preserve arbitrary valid Stremio stream/subtitle addons rather than coding to one
  provider.
- Preserve standalone Kodi settings, skins, navigation, playback, and subtitle
  addons.
- Keep profile/device/session boundaries exact and fail closed on mismatch.
- Keep lifecycle effects generation-bound so delayed callbacks cannot mutate a newer
  playback.

## Tests

Bridge changes should include focused Node tests and pass:

```bash
npm ci
npm test
npm run policy
npm audit --omit=dev --audit-level=high
```

Service-backed contracts run in CI with real Redis and PostgreSQL. Storage or rollout
changes must also pass the immutable production-image protocol topology.

Kodi changes should run the native Jumpgate suites and the protected dual-ABI Android
workflow. Android artifacts are not accepted until the repository verifier confirms
the expected package, version, ABI, signer, native symbols, and absence of credential
material.

Changes affecting provider behavior, app return, playback replacement, Trakt,
subtitles, pairing, or profile switching require device UAT. A unit test cannot prove
cross-app Android lifecycle behavior.

## Secrets And Test Data

Never commit or paste real credentials, tokens, configured profile blobs, addon URLs,
private logs, APKs, keystores, emulator dumps, databases, or provider responses.
Generate adversarial keys and credential-shaped fixtures at runtime so current source
and sanitized release history remain scanner-clean.

Run gitleaks with full redaction against the changed release tree and custom release
history. Treat findings as unresolved until the exact file, rule, and provenance have
been reviewed.

## Kodi Upstream

Keep the public Kodi release branch directly above a pinned `xbmc/xbmc` upstream base
so GitHub preserves the fork relationship and downstream changes remain reviewable.
Do not squash or rewrite Kodi's upstream history. Sanitization applies only to the
Jumpgate delta above that base.

Kodi-derived code remains GPL-2.0-or-later. Bridge code is MIT licensed. New files
must use the component's existing license and notice conventions.
