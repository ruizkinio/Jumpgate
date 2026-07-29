# Physical UAT Evidence

`physical-uat.json` is added only after the exact candidate has completed sanitized
physical ARM phone and TV testing. The validator accepts exactly one record for each
device class. Each record binds device model/API/ABI, the candidate's ABI-specific APK
and signer hashes, the deployed Bridge image digest, candidate commits, and every UAT
section. Evidence expires after 30 days.

`evidenceUrl` must be an immutable public blob URL in a Jumpgate repository at a full
commit SHA. The validator downloads that blob and verifies `evidenceSha256`; issue pages,
branch URLs, expiring Action artifacts, query strings, and fragments are rejected. Serial
numbers, account names, private URLs, tokens, logs, pairing data, and QR images are not
allowed in either the index or the evidence blob.

There is deliberately no `ready`, `passed`, or override field. Manual readiness is
derived from the records, locked artifacts, current gitlinks, component ancestry,
protected workflow runs, stable signer, and Stremio dependency ancestry.

The manual `require-ready` workflow mints a short-lived token from a dedicated GitHub
App. Install that App only on `Jumpgate`, `Jumpgate-bridge`, and `Jumpgate-kodi`, with
read-only Actions, attestations, contents, metadata, secret-scanning-alerts, and
security-events permissions.
Store its client ID as `JUMPGATE_AUDIT_APP_CLIENT_ID` and its private key as
`JUMPGATE_AUDIT_APP_PRIVATE_KEY`; never reuse the App for publishing or write access.
The token cryptographically verifies the Bridge deployment subject through GitHub
OIDC and reads cross-repository artifacts and current security state. Repository-local
`GITHUB_TOKEN` permissions are not treated as cross-repository proof.
