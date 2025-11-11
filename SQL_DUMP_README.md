# IntelliBid SQL Dump File

## ⚠️ Important Security Notice

The `intellibid_dump.sql` file contains database schema and sample data with **placeholder values** for Azure secrets.

### Placeholder Values (DO NOT use in production):
- `YOUR_AZURE_OPENAI_KEY_HERE` - Replace with your actual Azure OpenAI key
- `YOUR_AZURE_STORAGE_ACCOUNT_KEY_HERE` - Replace with your actual Azure Storage key
- `YOUR_AZURE_SEARCH_ADMIN_KEY_HERE` - Replace with your actual Azure Search key

### Where Real Secrets Are Stored:
All production secrets are safely stored in:
1. **Replit Secrets** - For development environment
2. **Azure Key Vault** or environment variables - For production deployment

### Usage:
This SQL dump is for database structure reference and sample data only. When restoring, make sure to configure your actual Azure secrets through environment variables or Replit Secrets.

**Never commit real API keys or secrets to version control!**
