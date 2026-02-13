# Chapter 5 Notes

## Secrets
- Encrypted at rest (AES-256)
- Masked in logs
- Decrypted in-memory on runner

## Leakage Vectors
1. Base64 encoding (bypasses masking)
2. Substring extraction
3. HTTP exfiltration
4. Artifact upload
5. Third-party actions

## Protection
- Forks don't get secrets
- Pin actions to SHA
- Validate all inputs
- Use OIDC (short-lived tokens)

## OIDC Benefits
- No stored credentials
- Auto-expiring
- Audit trail

## One-Sentence
Secrets are encrypted environment variables that are masked in logs but can still leak via encoding/exfiltration/third-party actions, with modern OIDC providing auto-expiring tokens that eliminate the need for stored long-lived credentials.
