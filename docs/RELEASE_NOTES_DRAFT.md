# Jumpgate {{VERSION}}

> **Release-owner draft:** Do not publish this file as release notes until every item in
> the publication gate below is complete and every `{{PLACEHOLDER}}` has been replaced.

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
| `{{ARM64_APK_NAME}}` | `{{ARM64_APK_SHA256}}` | `arm64-v8a` | `io.github.ruizkinio.jumpgate` | `{{SIGNER_SHA256}}` |
| `{{ARMV7_APK_NAME}}` | `{{ARMV7_APK_SHA256}}` | `armeabi-v7a` | `io.github.ruizkinio.jumpgate` | `{{SIGNER_SHA256}}` |

- Jumpgate Kodi commit: `{{KODI_COMMIT}}`
- Bridge commit: `{{BRIDGE_COMMIT}}`
- Bridge image digest: `{{BRIDGE_IMAGE_DIGEST}}`
- Coordinated release commit: `{{COORDINATION_COMMIT}}`
- Protected release validation: `{{RELEASE_VALIDATION_URL}}`
- Sanitized device UAT evidence: `{{UAT_EVIDENCE_URL}}`

## Compatibility

- Android devices supported by one of the published ABIs.
- Stremio for Android `{{STREMIO_VERSION}}`, containing the external-player lifecycle
  fix verified by the release gate.
- Stream and subtitle addons selected during provider import, subject to the provider
  returning a valid Stremio resource and a transport Kodi can play.
- Direct HTTP(S), playlist-backed, torrent-backed, debrid, and addon-proxied sources
  covered by the published UAT matrix.

Container or URL shape is not playback identity. A valid M3U/M3U8, M2TS, MKV, MP4, or
other supported transport may remain local-only when the provider response does not
contain enough canonical context for a safe Trakt claim.

## Known Limitations

{{KNOWN_LIMITATIONS_OR_NONE}}

- Clearlogos are optional and unavailable for some titles; text is the fallback.
- Android remembers preferred media apps by matching intent. Choosing **Always** can
  affect matching video launches from other apps and may be scheme-specific.
- Provider compatibility cannot be guaranteed when an addon returns an invalid
  Stremio resource or a transport Kodi cannot play.

## Publication Gate

- [ ] Public Kodi history contains only the audited Jumpgate delta above the official
      Kodi parent and no credential-bearing development refs.
- [ ] Trakt credentials exposed in historical development refs have been rotated.
- [ ] Protected cross-repository security audit has zero unresolved findings.
- [ ] One recoverable stable Android signer is provisioned and matches both APKs.
- [ ] Both APKs pass package, ABI, signer, secret, and provenance verification.
- [ ] Physical ARM phone and TV UAT pass the complete public protocol.
- [ ] The public Stremio Android release contains the required lifecycle fix.
- [ ] Repeated playback passes without force-closing Stremio or Jumpgate.
- [ ] All placeholders and draft warnings have been removed from the final GitHub
      release body.
