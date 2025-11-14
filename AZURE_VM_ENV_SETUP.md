# Azure VM Environment Variables Setup

## Problem
```
Error: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
```

This error occurs when the PostgreSQL password is missing or not set correctly in your Azure VM environment.

## Solution: Set Environment Variables in Azure VM

### Option 1: Using .env File (Quick Fix)

1. **SSH into your Azure VM:**
   ```bash
   ssh azureuser@your-vm-ip
   ```

2. **Navigate to your application directory:**
   ```bash
   cd /home/azureuser/IntelliBidEngineV1
   ```

3. **Create a `.env` file:**
   ```bash
   nano .env
   ```

4. **Add all required environment variables:**
   ```bash
   # Database Connection
   DATABASE_URL=postgresql://username:password@host:5432/database?sslmode=require
   PGHOST=your-postgres-server.postgres.database.azure.com
   PGPORT=5432
   PGUSER=intellibid_admin
   PGPASSWORD=YourActualPassword
   PGDATABASE=intellibid

   # Azure OpenAI
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   AZURE_OPENAI_KEY=your-key-here
   AZURE_OPENAI_API_VERSION=2024-02-15-preview
   AZURE_OPENAI_DEPLOYMENT=gpt-4o
   AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002

   # Azure AI Search
   AZURE_SEARCH_ENDPOINT=https://your-search.search.windows.net
   AZURE_SEARCH_KEY=your-search-key

   # Azure Blob Storage
   AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...

   # Session Secret
   SESSION_SECRET=your-random-secret-here

   # Optional: OpenAI (if using non-Azure OpenAI)
   AI_INTEGRATIONS_OPENAI_API_KEY=sk-...
   AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
   ```

5. **Save and exit** (Ctrl+X, then Y, then Enter)

6. **Restart your application:**
   ```bash
   pm2 restart all
   # OR if running manually:
   npm start
   ```

### Option 2: Using PM2 Ecosystem File (Recommended)

1. **Create `ecosystem.config.js`:**
   ```bash
   nano ecosystem.config.js
   ```

2. **Add configuration:**
   ```javascript
   module.exports = {
     apps: [{
       name: 'intellibid',
       script: 'dist/index.js',
       env: {
         NODE_ENV: 'production',
         PORT: 5000,
         DATABASE_URL: 'postgresql://user:pass@host:5432/db?sslmode=require',
         AZURE_OPENAI_ENDPOINT: 'https://your-resource.openai.azure.com',
         AZURE_OPENAI_KEY: 'your-key',
         AZURE_OPENAI_API_VERSION: '2024-02-15-preview',
         AZURE_OPENAI_DEPLOYMENT: 'gpt-4o',
         AZURE_OPENAI_EMBEDDING_DEPLOYMENT: 'text-embedding-ada-002',
         AZURE_SEARCH_ENDPOINT: 'https://your-search.search.windows.net',
         AZURE_SEARCH_KEY: 'your-search-key',
         AZURE_STORAGE_CONNECTION_STRING: 'DefaultEndpointsProtocol=https;...',
         SESSION_SECRET: 'your-session-secret'
       }
     }]
   };
   ```

3. **Start with PM2:**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   ```

### Option 3: System Environment Variables (Most Secure)

1. **Edit system profile:**
   ```bash
   sudo nano /etc/environment
   ```

2. **Add variables:**
   ```bash
   DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
   AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
   AZURE_OPENAI_KEY="your-key"
   # ... add all other variables
   ```

3. **Reload environment:**
   ```bash
   source /etc/environment
   ```

4. **Restart application**

### Option 4: Azure Key Vault (Production Best Practice)

For the most secure setup, use Azure Key Vault to manage secrets:

1. **Install Azure CLI:**
   ```bash
   curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
   ```

2. **Login to Azure:**
   ```bash
   az login
   ```

3. **Create a Key Vault** (if not exists):
   ```bash
   az keyvault create \
     --name intellibid-vault \
     --resource-group your-resource-group \
     --location eastus
   ```

4. **Store secrets:**
   ```bash
   az keyvault secret set --vault-name intellibid-vault \
     --name DATABASE-URL \
     --value "postgresql://user:pass@host:5432/db?sslmode=require"
   
   az keyvault secret set --vault-name intellibid-vault \
     --name AZURE-OPENAI-KEY \
     --value "your-openai-key"
   
   # Add all other secrets...
   ```

5. **Grant VM access:**
   ```bash
   # Enable system-assigned managed identity for VM
   az vm identity assign --name your-vm-name --resource-group your-rg
   
   # Grant access to Key Vault
   az keyvault set-policy --name intellibid-vault \
     --object-id <vm-principal-id> \
     --secret-permissions get list
   ```

6. **Install Azure SDK and load secrets in code** (requires code changes)

## Quick Verification

Check if DATABASE_URL is set:
```bash
echo $DATABASE_URL
```

Test database connection:
```bash
cd /home/azureuser/IntelliBidEngineV1
node -e "const { Pool } = require('pg'); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query('SELECT NOW()').then(() => { console.log('✅ Database connected!'); process.exit(0); }).catch(err => { console.error('❌ Database error:', err.message); process.exit(1); });"
```

## Troubleshooting

### Check Current Environment
```bash
printenv | grep DATABASE_URL
printenv | grep AZURE
```

### View Application Logs
```bash
# If using PM2
pm2 logs intellibid

# If using systemd
journalctl -u intellibid -f

# Direct log file
tail -f /home/azureuser/IntelliBidEngineV1/logs/app.log
```

### Common Issues

1. **Password contains special characters:**
   - URL-encode special characters in DATABASE_URL
   - Example: `p@ssw0rd` → `p%40ssw0rd`

2. **SSL/TLS Issues:**
   - Ensure `?sslmode=require` is in DATABASE_URL
   - Azure PostgreSQL requires SSL

3. **Permission Issues:**
   - Check .env file permissions: `chmod 600 .env`
   - Ensure app user can read the file

## Next Steps

After setting environment variables:
1. Restart your application
2. Check logs for successful startup
3. Test API endpoint: `curl http://localhost:5000/api/projects`
4. Set up nginx reverse proxy (if not already done)
5. Configure SSL certificate with Let's Encrypt

## Security Notes

- ⚠️ **Never commit `.env` files to Git**
- ⚠️ **Never log environment variables**
- ⚠️ **Use Azure Key Vault for production**
- ⚠️ **Rotate secrets regularly**
- ⚠️ **Use HTTPS in production**
