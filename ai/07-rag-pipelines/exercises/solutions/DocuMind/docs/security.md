# Security & Privacy

## Data Encryption

All data is encrypted at rest using AES-256 and in transit using TLS 1.3. Encryption keys are managed via AWS KMS with automatic rotation every 90 days.

## Authentication

### Passwords
Passwords must be at least 12 characters and include a mix of letters, numbers, and symbols. Passwords are hashed using bcrypt before storage — we never store plaintext passwords.

### Two-Factor Authentication (2FA)
2FA is available for all accounts and required by default for Admin and Owner roles. Supported methods:
- Authenticator apps (TOTP): Google Authenticator, Authy, 1Password
- SMS (not recommended — available as fallback only)
- Hardware security keys (FIDO2/WebAuthn) — Enterprise only

To enable 2FA: Account Settings > Security > Two-Factor Authentication.

### Single Sign-On (SSO)
SSO via SAML 2.0 is available for Business and Enterprise plans. Supported identity providers:
- Okta
- Azure Active Directory
- Google Workspace
- OneLogin

Contact your account manager to configure SSO for your organization.

### Session Management
Sessions expire after 30 days of inactivity. You can view and revoke active sessions from Account Settings > Security > Active Sessions. Admins can enforce shorter session timeouts at the Workspace level.

## Access Control

### Role-Based Access Control (RBAC)
All permissions are role-based (Owner, Admin, Member, Viewer). Permissions cannot be customized beyond these roles in standard plans. Enterprise customers can request custom role configurations.

### IP Allowlisting
Enterprise customers can restrict access to specific IP ranges. Configure in Workspace Settings > Security > IP Allowlist.

### Audit Logs
All user actions (login, data access, settings changes, member changes) are logged. Audit logs are retained for:
- Pro: 30 days
- Business: 90 days
- Enterprise: 1 year (or longer by request)

Access audit logs from Workspace Settings > Audit Log.

## Data Residency

Data is stored in the US (us-east-1) by default. EU data residency is available for Enterprise customers (stored in eu-west-1, Frankfurt). Data residency cannot be changed after account creation.

## Compliance

The platform is compliant with:
- **SOC 2 Type II** — audit report available on request
- **GDPR** — EU data processing agreement (DPA) available at legal@example.com
- **HIPAA** — Business Associate Agreement (BAA) available for Enterprise customers handling PHI

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly to security@example.com. Do not disclose vulnerabilities publicly before we have had a chance to investigate and remediate. We aim to respond to security reports within 24 hours.

We operate a bug bounty program — details at example.com/security/bounty.
