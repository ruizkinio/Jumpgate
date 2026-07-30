# Reddit Launch Draft

> **Do not publish before the coordinated release gate passes.** Replace every
> `{{PLACEHOLDER}}`, link only to the public GitHub release, and use only screenshots
> audited to contain no configured URL, pairing code, account detail, token, provider
> URL, media credential, or private notification.

## Recommended Title

I turned Kodi into a source-aware external player for Stremio: Jumpgate {{VERSION}}

## Alternate Titles

- Jumpgate {{VERSION}}: keep Kodi as your player while choosing streams in Stremio
- I built a Kodi-based external player for Stremio that does not guess Trakt identity

## Post

Jumpgate is an Android Kodi fork plus a private Stremio Bridge. You browse and choose a
source in Stremio, then Jumpgate plays it with Kodi's playback engine, settings, skins,
subtitle controls, local history, and installed subtitle addons.

The part I cared about most was making the handoff source-aware instead of guessing
from a URL or filename. Jumpgate binds playback to the exact result returned by the
selected Stremio provider and to the paired profile. It does **not** identify users or
titles by IP address, so shared Wi-Fi, CGNAT, mobile data, VPN changes, and multiple
profiles cannot select another profile through network coincidence.

What it supports in this release:

- normal Kodi behavior when Jumpgate is opened directly;
- external-player Back/result handling that returns to Stremio;
- multiple isolated paired profiles;
- local resume and history, even without Trakt;
- optional Trakt sync only when an exact canonical source claim exists;
- providers selected from your Stremio setup rather than one hard-coded stream addon;
- direct, playlist-backed, torrent-backed, debrid, and addon-proxied stream results;
- Stremio text/ASS subtitles and integrity-checked VobSub delivery, while keeping Kodi
  subtitle addons and controls;
- a Jumpgate loading overlay with canonical metadata and clearlogo fallback.

The safety rule is simple: if a source plays but Jumpgate cannot prove its canonical
identity, it stays local-only. It will not guess a Trakt title from the filename,
artwork, hash, or previous playback.

Install guide, verified APKs, hashes, source, known limitations, and UAT evidence:

{{GITHUB_RELEASE_URL}}

This is not affiliated with Kodi, Stremio, Trakt, TMDB, or any stream/addon provider.
Jumpgate does not provide media or bundle a catalog, debrid service, or stream source.
Provider compatibility still depends on the addon returning a valid Stremio resource
and a transport Kodi can play.

Please do not paste configured addon URLs, install links, pairing codes, provider URLs,
tokens, or raw logs into Reddit or GitHub issues. Those can be private capabilities even
when they look encrypted. The issue forms explain how to report a problem safely.

## First Comment

Setup order matters:

1. Install the APK matching your Android device ABI.
2. Open Jumpgate directly and pair the profile.
3. Import/select the Stremio providers for that profile.
4. Optionally connect Trakt and add a TMDB v3 key.
5. Install the generated private addon into the intended Stremio profile.
6. Set Stremio to **External player** and choose Jumpgate from Android's player chooser.

You never need to copy a Bridge URL into Kodi. Do not share the generated addon or
management URLs between users or profiles.

## Publication Checklist

- [ ] Use the final version and one public GitHub release URL.
- [ ] Link the public source and evidence; do not link a development APK.
- [ ] State only provider classes that passed physical-device UAT.
- [ ] Add only audited screenshots with private notifications and media/account details
      removed.
- [ ] Confirm the install steps match the final Bridge UI and release artifacts.
- [ ] Remove this checklist and every draft warning before posting.
