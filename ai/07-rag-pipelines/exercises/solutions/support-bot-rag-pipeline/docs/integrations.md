# Integrations

## Available Integrations

The platform supports the following third-party integrations:

### Productivity & Storage
- **Google Drive** – sync files and folders into your workspace
- **Dropbox** – import and export files
- **Notion** – pull in pages and databases as read-only content
- **Confluence** – sync documentation spaces

### Communication
- **Slack** – receive notifications and trigger actions from Slack commands
- **Microsoft Teams** – receive notifications in Teams channels
- **Email (SMTP)** – send automated emails via your own SMTP server

### Developer Tools
- **GitHub** – link repositories, trigger workflows on PR events
- **GitLab** – similar to GitHub integration
- **Jira** – sync tasks and issues bidirectionally
- **Webhooks** – send HTTP POST events to any endpoint on platform events

### Analytics
- **Google Analytics 4** – track usage events
- **Segment** – pipe events to your existing data warehouse
- **Mixpanel** – product analytics

## Setting Up an Integration

1. Go to Workspace Settings > Integrations
2. Click the integration you want to connect
3. Click **Connect** and follow the OAuth flow (or enter API credentials)
4. Configure the sync settings (frequency, filters, permissions)
5. Click **Save**

Most integrations use OAuth 2.0. You will be redirected to the provider's authorization page and returned to the platform after granting permissions.

## Integration Permissions & Scopes

The platform requests the minimum required permissions for each integration. For example, the Slack integration only requests `channels:read` and `chat:write` scopes — it cannot read message history.

You can review and revoke integration permissions at any time from Workspace Settings > Integrations > [Integration Name] > Permissions.

## Webhook Configuration

To configure a webhook:
1. Go to Workspace Settings > Integrations > Webhooks
2. Click **Add Webhook**
3. Enter the endpoint URL
4. Select the events to subscribe to (e.g., `task.created`, `member.invited`)
5. Optionally add a secret for payload signature verification

Webhook payloads are signed with HMAC-SHA256. Verify the `X-Signature-256` header in your receiving server to ensure authenticity.

## Integration Limits by Plan

| Plan       | Max Integrations |
|------------|-----------------|
| Free       | 2               |
| Pro        | 10              |
| Business   | 25              |
| Enterprise | Unlimited       |

## Troubleshooting Integrations

If an integration stops syncing:
- Check the integration status in Workspace Settings > Integrations > [Name] > Status
- Re-authenticate by clicking **Reconnect**
- Check if the third-party service has revoked access (common after password changes)
- Review the sync error log for details

For persistent issues, contact support@example.com with the integration name and error message.
