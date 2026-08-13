# Jumpgate 3.0.0

> **Release-owner draft:** Do not publish this file as release notes until every item in
> the publication gate below is complete and every remaining `{{PLACEHOLDER}}` has been
> replaced from protected release evidence.

Jumpgate turns Kodi into a source-aware external player for Stremio on Android. It
keeps Kodi's playback engine, settings, skins, local history, and subtitle addons while
a private Bridge carries the exact Stremio source context selected by the user.

## What Is Included

- Jumpgate for Android, built for `arm64-v8a` and `armeabi-v7a`.
- Jumpgate Manager for pairing and managing isolated profiles.
- The hosted Jumpgate Bridge and private Stremio addon configuration flow.
- Source-backed local history and optional canonical Trakt synchronization.
- Private text, ASS/SSA, and integrity-checked VobSub subtitle delivery.
- External-player lifecycle handling that returns to Stremio without requiring either
  app to be force-closed before the next playback.

## Why Source Claims Matter

Jumpgate does not guess a profile or Trakt title from an IP address, filename, URL,
artwork, torrent hash, or subtitle hash. A cloud write requires the exact canonical
source claim created from the matching Stremio provider response and paired profile.

If a source is playable but cannot be claimed canonically, Jumpgate still plays it and
records local history. It intentionally skips Trakt rather than scrobbling the wrong
film or episode.

## Install

1. Read the release-specific requirements and known limitations below.
2. Download the APK for your Android device ABI from this GitHub release.
3. Verify its SHA-256 and release signer fingerprint against the values below.
4. Open Jumpgate directly and pair a profile before installing its generated Stremio
   addon.
5. Import and select the Stremio providers for that profile.
6. Optionally connect Trakt and add a TMDB v3 key.
7. Install the generated private addon into the intended signed-in Stremio profile.
8. Set Stremio's default player to **External player**, start a Jumpgate source, and
   select **Jumpgate** in Android's player chooser.

Follow the complete
[setup and troubleshooting guide](https://github.com/ruizkinio/Jumpgate#setup).
Never post or share a configured addon URL, install link, management link, pairing
code, token, or provider URL.

## Verified Artifacts

| Artifact | SHA-256 | ABI | Package | Signer SHA-256 |
| --- | --- | --- | --- | --- |
| `Jumpgate-22.0-ALPHA2-Jumpgate-3.0.0-arm64-v8a.apk` | `0ffec97546bf7e946e24826cebd2f98816122f84a03cef8ad208a68d4dac312a` | `arm64-v8a` | `io.github.ruizkinio.jumpgate` | `10625572b5f34c5125b030dd5ab5fd40bdcd263d0fa8e2073ddee70435970551` |
| `Jumpgate-22.0-ALPHA2-Jumpgate-3.0.0-armeabi-v7a.apk` | `9ff620c0d07f7dffd960a0b7620b30dfcbbdb7efcbe5e969ac719b7d643ab763` | `armeabi-v7a` | `io.github.ruizkinio.jumpgate` | `10625572b5f34c5125b030dd5ab5fd40bdcd263d0fa8e2073ddee70435970551` |

- Jumpgate Kodi commit: `b105087fb2ec00db4576e2f4b1221f9c45acd84f`
- Bridge commit: `28848c13ae515c651e267e1f1ab9f24ebabd168c`
- Bridge image digest: `sha256:05e9d5a79aaff27a81b61f548bef78933ec541d5af59b1d1f2bcb2cc3ca17b6a`
- Candidate lock commit: `86c5ee83211c48c49b386aa0fe3df0ec3d61c47a`
- Protected non-physical release validation: `https://github.com/ruizkinio/Jumpgate/actions/runs/31706953795`
- Sanitized device UAT evidence: `{{UAT_EVIDENCE_URL}}`

## Compatibility

- Android devices supported by one of the published ABIs.
- Stremio Android Mobile `2.3.2` and Android TV `1.10.4`, pinned by APK hash,
  package/version, ABI, and signing certificate for the release gate.
- Stream and subtitle addons selected during provider import, subject to the provider
  returning a valid Stremio resource and a transport Kodi can play.
- Direct HTTP(S), playlist-backed, torrent-backed, debrid, and addon-proxied sources
  covered by the published UAT matrix.

Container or URL shape is not playback identity. A valid M3U/M3U8, M2TS, MKV, MP4, or
other supported transport may remain local-only when the provider response does not
contain enough canonical context for a safe Trakt claim.

## Known Limitations

- Clearlogos are optional and unavailable for some titles; text is the fallback.
- Android remembers preferred media apps by matching intent. Choosing **Always** can
  affect matching video launches from other apps and may be scheme-specific.
- Stremio Android TV `1.10.4` can reopen **Who's watching?** after an external-player
  round trip for Premium accounts with profiles. Reselect the same profile; exact
  same-card replay must still work without force-closing either app. This is tracked as
  `Stremio/stremio-bugs#2708`.
- Provider compatibility cannot be guaranteed when an addon returns an invalid
  Stremio resource or a transport Kodi cannot play.

## Publication Gate

- [x] Public Kodi history contains only the audited Jumpgate delta above the official
      Kodi parent and no credential-bearing development refs.
- [x] Protected cross-repository security audit has zero unresolved findings.
- [x] One recoverable stable Android signer is provisioned and matches both APKs.
- [x] Both APKs pass package, ABI, signer, secret, and provenance verification.
- [x] The exact Bridge deployment passes attestation and live readiness verification.
- [ ] Physical ARM phone and TV UAT pass the complete public protocol.
- [x] Supported Stremio Mobile and TV APKs pass static package, ABI, signer, intent,
      result-contract, and unload-path verification.
- [ ] Repeated playback passes without force-closing Stremio or Jumpgate.
- [ ] All placeholders and draft warnings have been removed from the final GitHub
      release body.
