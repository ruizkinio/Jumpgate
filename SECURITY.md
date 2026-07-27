# Security Policy

## Supported Versions

Jumpgate is currently pre-release. Security fixes are made only on the latest
published release and current protected development branches. Development APKs,
configured addon URLs, and old deployment snapshots are not supported releases.

## Reporting A Vulnerability

Use GitHub private vulnerability reporting on the affected Jumpgate repository. Do
not open a public issue for a suspected credential leak, cross-profile access,
authentication bypass, SSRF, token disclosure, unsafe subtitle payload, or malicious
APK/build-chain finding.

Include:

- The affected component and exact version or commit.
- Reproduction steps using synthetic credentials and non-private media.
- Expected and observed behavior.
- Security impact and whether the issue has been exploited.
- Sanitized logs or requests with every capability, token, URL credential, cookie,
  provider URL, and configured addon path removed.

Never send a real configured addon URL, pairing code, Trakt token, TMDB key, debrid
credential, provider header, Fly token, database URL, storage key, signing key, APK
keystore, or device credential.

## Security Boundaries

The following are release invariants:

- Playback identity is never selected by IP address, title, filename, URL, artwork,
  torrent hash, OpenSubtitles hash, or other heuristic metadata.
- Trakt writes require an authenticated paired device and exact canonical source
  claim from the matching Bridge profile.
- Unknown content remains playable and local-only; uncertainty must not become a
  guessed cloud identity.
- Configured addon and management URLs are bearer capabilities and must be redacted.
- Provider URLs, cookies, headers, and credentials remain encrypted or server-side.
- Production Bridge startup fails closed without PostgreSQL, Redis, private object
  storage, HTTPS origin configuration, and stable purpose-separated key material.
- Subtitle parts are bounded, content-type constrained, checksum verified, privately
  staged, and replaced atomically.
- Android credentials use platform-backed encrypted storage; plaintext legacy Trakt
  token files are deleted without being imported.
- Release workflows use immutable action, container, source, and tool references.

## Public Artifacts

Official APKs are built by the protected Android workflow, signed for the release,
checked for package/version/ABI consistency, scanned for private material, and
published with SHA-256 hashes and signer fingerprints. Do not install an APK solely
because its filename contains Jumpgate.

Official Bridge releases are built once, tested by digest, and deployed by immutable
image digest through the protected production environment. A healthy process is not
enough; `/health/ready` must pass its external storage protocols.

## Credential Exposure

Treat a committed or publicly posted credential as compromised even after deletion.
Rotate it at the provider, invalidate dependent sessions, audit access, and publish
from sanitized history. Rewriting Git history does not revoke old clones.
