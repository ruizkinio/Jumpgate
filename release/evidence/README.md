# Physical UAT Evidence

`physical-uat.json` is added only after the exact candidate has completed sanitized
physical ARM phone and TV testing. The validator accepts exactly one record for each
device class. Each record binds device model/API/ABI, the candidate's ABI-specific APK
and signer hashes, the exact device-class and ABI-specific Stremio APK and signer, the
deployed Bridge image digest, candidate commits, and every UAT section. Phone evidence
must use the locked Mobile baseline; TV evidence must use the locked Android TV baseline.
Evidence expires after 30 days.

`evidenceUrl` must be an immutable public blob URL in a Jumpgate repository at a full
commit SHA. The validator downloads that blob and verifies `evidenceSha256`; issue pages,
branch URLs, expiring Action artifacts, query strings, and fragments are rejected. Serial
numbers, account names, private URLs, tokens, logs, pairing data, and QR images are not
allowed in either the index or the evidence blob.

There is deliberately no `ready`, `passed`, or override field. Manual readiness is
derived from the records, locked artifacts, current gitlinks, component ancestry,
protected workflow runs, stable signer, and independently verified native Stremio APK
bytes, manifests, ABI sets, and signing certificate. Static APK verification does not
replace the lifecycle and exact same-card replay cases in physical UAT.

The manual `require-ready` workflow mints a short-lived token from a dedicated GitHub
App. Install that App only on `Jumpgate`, `Jumpgate-bridge`, and `Jumpgate-kodi`, with
read-only Actions, attestations, contents, metadata, secret-scanning-alerts, and
security-events permissions.
Store its client ID as `JUMPGATE_AUDIT_APP_CLIENT_ID` and its private key as
`JUMPGATE_AUDIT_APP_PRIVATE_KEY`; never reuse the App for publishing or write access.
The token cryptographically verifies the Bridge deployment subject through GitHub
OIDC and reads cross-repository artifacts and current security state. Repository-local
`GITHUB_TOKEN` permissions are not treated as cross-repository proof.

## Security Audit Evidence

`security-audit.json` is never committed. The protected `require-ready` job downloads
the exact policy-pinned Linux x64 Gitleaks archive, verifies its SHA-256 before bounded
extraction, and requires the executable to report version `8.30.1`. It rejects inherited
Git or Gitleaks configuration and uses an explicit configuration that extends only the
scanner's pinned default rules.

Each audit replica captures public heads and tags before fetch, after fetch, and after
scan. It fetches exact objects into private audit namespaces. Root and Bridge cover all
public history. Kodi records a reviewed range for every public head and tag and scans
only commits not reachable from the exact simultaneously captured official `xbmc/xbmc`
public refs. Added, removed, moved, or retagged refs invalidate the report.

Findings are reduced immediately to sanitized records containing only a SHA-256
fingerprint, rule ID, public commit, normalized repository-relative path, and line/column
location. Secret text, matches, source excerpts, authors, emails, raw reports, clones,
and patches remain in private temporary directories and are deleted. Two fresh clones
must produce byte-identical sanitized reports. Only that reproduced report is uploaded
as an Actions artifact. A separate step then refuses unresolved or stale findings, so a
failed audit remains reviewable without weakening the zero-unresolved release gate.

`release/security-allowlist.json` is the sole allowlist. Every entry must identify an
observed fingerprint, include a sanitized review rationale, and be unexpired. Missing,
extra, stale, expired, or unresolved entries fail the protected job. The generated report
binds the exact allowlist bytes by SHA-256.
