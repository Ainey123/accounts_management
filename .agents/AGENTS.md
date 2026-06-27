# NEXUS Operations Workspace Rules

- **Database Preservation**: NEVER execute database resets (`db push --force-reset` or similar destructive prisma operations) or run user-clearing seed scripts (like `reset-users.js`) during deployments or environments setup. Always preserve existing user tables, Gmail accounts, OAuth tokens, and activity logs.
- **Dynamic OAuth Caching**: Securely preserve the `GmailAccount` table. Tokens are refreshed and updated dynamically in the database.
