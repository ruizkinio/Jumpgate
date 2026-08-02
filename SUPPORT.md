# Support

Jumpgate is pre-release software. Use the public UAT protocol before reporting a
playback or provider compatibility problem.

## Where To Report

- General setup, playback, provider, subtitle, and lifecycle problems:
  [Jumpgate issues](https://github.com/ruizkinio/Jumpgate/issues).
- Security vulnerabilities: use GitHub's private **Report a vulnerability** flow for
  the affected repository. Do not open a public issue first.
- Kodi engine behavior that also reproduces in unmodified Kodi belongs upstream; state
  clearly whether you reproduced it there.
- Stremio Android TV `1.10.4` reopening **Who's watching?** after an external-player
  round trip is tracked upstream as
  [`Stremio/stremio-bugs#2708`](https://github.com/Stremio/stremio-bugs/issues/2708).
  A spinner or failed replay after reselecting the profile still belongs in Jumpgate issues.

## Include

- Jumpgate release version and Android package version.
- Device model, Android version/API level, and ABI (`arm64-v8a` or `armeabi-v7a`).
- Stremio version and whether Jumpgate was launched as an external player or directly.
- Exact reproduction steps, expected behavior, and observed behavior.
- Provider and media/container category, using provider names and sanitized metadata
  rather than private request URLs.
- Whether the issue reproduces after returning to Stremio and playing a second time
  without force-closing either app.
- Sanitized log excerpts limited to the relevant timestamps and error lines.

## Never Include

- Configured addon URLs, `stremio://` install links, encrypted config blobs, management
  links, or pairing codes.
- Profile/device IDs or tokens, authorization headers, cookies, provider/debrid URLs,
  signed media URLs, request headers, or torrent credentials.
- Stremio, Trakt, TMDB, Fly.io, debrid, provider, database, Redis, S3, or Android
  signing credentials.
- Raw Bridge/Kodi logs, account screenshots, emulator dumps, or APKs that may contain
  private data. Redact locally before attaching anything.

Maintainers will ask for the narrowest additional evidence needed. A request to post
private capabilities or credentials is not a valid support procedure.
