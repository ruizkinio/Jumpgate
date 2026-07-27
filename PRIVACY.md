# Privacy

Jumpgate is a self-hostable connection between a user's Stremio providers and paired
Jumpgate players. It does not use IP addresses as account or playback identity.

## Data Processed By The Bridge

Depending on enabled features, a Bridge deployment processes:

- Profile and device identifiers, profile display names, and encrypted device
  credentials.
- Selected Stremio provider descriptors and credentials required to request their
  resources.
- Short-lived source contexts and canonical content identity returned by those
  providers.
- Resume position, completion state, selected track preferences, and bounded history
  records.
- Trakt OAuth credentials and synchronization state when the user enables Trakt.
- An optional TMDB API key and metadata lookups when the user enables TMDB.
- Private subtitle payloads staged for a paired playback session.
- Client network addresses transiently for transport-level rate limiting and hosting
  logs, never for profile selection or playback correlation.

Jumpgate does not intentionally include product analytics or advertising trackers.
A deployment operator may still have infrastructure access logs from its proxy,
platform, database, Redis, or object store and is responsible for documenting and
retaining them appropriately.

## Storage

Production profile, OAuth, provider, and history records are stored in PostgreSQL.
Short-lived pairing, claim, playback, lease, and rate-limit state is stored in Redis.
Subtitle objects are stored privately in S3-compatible storage under opaque keys and
are deleted through a fenced lifecycle. Sensitive record fields are encrypted with
deployment-controlled key material.

Development mode can use local SQLite and in-process TTL state. It is intended for a
single private instance and is not the public multi-replica topology.

Jumpgate on Android stores local history and non-secret profile metadata in its app
profile. Device capabilities are protected with Android KeyStore-backed encryption.
Clearlogo cache files are bounded, expire, and contain public TMDB artwork only.

## Third Parties

Data is sent only when needed for enabled features:

- Stremio and selected addon/provider services supply catalogs, streams, subtitles,
  and account-specific provider configuration.
- Trakt receives canonical scrobble/history operations after explicit authorization.
- TMDB can receive canonical metadata lookups when configured.
- The Bridge hosting platform and configured PostgreSQL, Redis, and object storage
  process service data.

Jumpgate cannot control the privacy practices of user-selected Stremio addons,
debrid services, subtitle providers, Trakt, TMDB, or infrastructure operators.

## User Controls

- Trakt and TMDB are optional.
- Profiles can be switched, unpaired, or removed independently.
- Local-only playback does not authorize Trakt.
- Configured addon URLs must not be shared; install a separate configured URL for a
  different account/profile boundary.
- Operators can remove profile records and should provide backups, retention, and
  deletion procedures appropriate to their deployment.

## Sensitive Support Material

Do not attach raw logs, configured URLs, provider responses, emulator dumps, or
screenshots containing pairing codes to public issues. Provide synthetic,
capability-free reproductions instead.
