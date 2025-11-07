# 🔐 Environment Variables Setup Guide

This guide shows you how to securely configure environment variables for deploying IntelliBid to Linux or Azure.

---

## 📄 Files Created

1. **`export-env-vars.sh`** - Secure script that generates export commands with your actual values
2. **`.env.template`** - Safe template with placeholders (safe for version control)
3. **`.gitignore`** - Updated to protect sensitive `.env` files

---

## 🚀 Secure Linux Deployment

### **⚠️ IMPORTANT Security Notice**

The `export-env-vars.sh` script contains **REAL CREDENTIALS**. Always use it securely:

✅ **DO:**
- Save to a restricted-permission file
- Run in a private, trusted environment
- Delete output files after use
- Use Azure Key Vault for production

❌ **DON'T:**
- Display credentials in shared terminals
- Store in world-readable files (.bashrc, /etc/environment)
- Commit generated files to version control
- Run in multi-user systems

---

### **Recommended Method: Secure Systemd Service**

For production servers, use a systemd service with restricted environment file:

```bash
# Step 1: Generate environment file with secure permissions (600)
# The script automatically creates the file with restrictive permissions
./export-env-vars.sh --output /tmp/env-secure.sh

# Step 2: Move to secure location
sudo mkdir -p /etc/intellibid
sudo mv /tmp/env-secure.sh /etc/intellibid/environment
sudo chown root:root /etc/intellibid/environment

# Step 3: Remove 'export ' prefix for systemd
sudo sed -i 's/^export //' /etc/intellibid/environment

# Step 4: Create systemd service
sudo nano /etc/systemd/system/intellibid.service
```

Add this service configuration:
```ini
[Unit]
Description=IntelliBid RFT Evaluation Engine
After=network.target postgresql.service

[Service]
Type=simple
User=intellibid
WorkingDirectory=/opt/intellibid
EnvironmentFile=/etc/intellibid/environment
ExecStart=/usr/bin/node /opt/intellibid/dist/index.js
Restart=on-failure
RestartSec=10

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/intellibid

[Install]
WantedBy=multi-user.target
```

```bash
# Step 5: Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable intellibid
sudo systemctl start intellibid

# Step 6: Check status
sudo systemctl status intellibid
```

---

### **Alternative: Docker/Podman with Secret Management**

If using containers, use Docker secrets or Podman secrets:

```bash
# Generate environment file with secure permissions (600)
./export-env-vars.sh --output /tmp/env-secure.sh

# Create Docker secrets
while IFS='=' read -r key value; do
  if [[ ! $key =~ ^# && -n $key ]]; then
    # Remove 'export ' and quotes
    key=$(echo "$key" | sed 's/^export //')
    value=$(echo "$value" | tr -d "'\"")
    echo "$value" | docker secret create "${key,,}" -
  fi
done < <(grep '^export' /tmp/env-secure.sh)

# Clean up
rm /tmp/env-secure.sh

# Reference in docker-compose.yml
services:
  intellibid:
    image: intellibid:latest
    secrets:
      - database_url
      - session_secret
      # ... (add all secrets)
    environment:
      DATABASE_URL_FILE: /run/secrets/database_url
```

---

### **Testing Only: Temporary Session Variables**

For **testing purposes only** (NOT production):

```bash
# WARNING: Variables disappear after logout!
# Option 1: Auto-generated secure temp file
./export-env-vars.sh
# (Script will tell you the file path, e.g., /tmp/intellibid-env.XXXXXX)
source /tmp/intellibid-env.XXXXXX  # Use the path from script output
rm /tmp/intellibid-env.XXXXXX

# Option 2: Specify output location
./export-env-vars.sh --output ~/temp-env.sh
source ~/temp-env.sh
rm ~/temp-env.sh

# Verify
env | grep -E '(DATABASE_URL|AI_INTEGRATIONS|AZURE_)' | wc -l
# Should show: 13 variables

# Test the application
npm run build
npm start
```

---

## ☁️ Azure App Service Deployment (RECOMMENDED)

### **Method 1: Azure Portal UI (Easiest)**

1. Go to **Azure Portal** → Your App Service
2. Navigate to **Configuration** → **Application settings**
3. Click **+ New application setting** for each variable
4. Get values by running: `./export-env-vars.sh --output /tmp/env.sh && cat /tmp/env.sh && rm /tmp/env.sh`
5. For each variable:
   - **Name**: Variable name (e.g., `DATABASE_URL`)
   - **Value**: Value from script (without quotes)
   - Check **"Deployment slot setting"** if environment-specific
6. Click **Save** at the top
7. Restart your App Service

### **Method 2: Azure Key Vault (Most Secure - RECOMMENDED for Production)**

```bash
# Step 1: Create Key Vault
az keyvault create \
  --name intellibid-vault \
  --resource-group intellibid-rg \
  --location eastus

# Step 2: Enable Managed Identity on App Service
az webapp identity assign \
  --name intellibid-app \
  --resource-group intellibid-rg

# Step 3: Grant App Service access to Key Vault
IDENTITY_ID=$(az webapp identity show \
  --name intellibid-app \
  --resource-group intellibid-rg \
  --query principalId -o tsv)

az keyvault set-policy \
  --name intellibid-vault \
  --object-id $IDENTITY_ID \
  --secret-permissions get list

# Step 4: Store secrets in Key Vault
# Generate environment file with secure permissions (600)
./export-env-vars.sh --output /tmp/env-secure.sh

# Extract and store each secret
while IFS='=' read -r key value; do
  if [[ ! $key =~ ^# && -n $key ]]; then
    key=$(echo "$key" | sed 's/^export //' | tr '_' '-')
    value=$(echo "$value" | tr -d "'\"")
    az keyvault secret set \
      --vault-name intellibid-vault \
      --name "$key" \
      --value "$value"
  fi
done < <(grep '^export' /tmp/env-secure.sh)

# Clean up
rm /tmp/env-secure.sh

# Step 5: Configure App Service to use Key Vault references
az webapp config appsettings set \
  --name intellibid-app \
  --resource-group intellibid-rg \
  --settings \
    DATABASE_URL="@Microsoft.KeyVault(VaultName=intellibid-vault;SecretName=DATABASE-URL)" \
    SESSION_SECRET="@Microsoft.KeyVault(VaultName=intellibid-vault;SecretName=SESSION-SECRET)" \
    AI_INTEGRATIONS_OPENAI_API_KEY="@Microsoft.KeyVault(VaultName=intellibid-vault;SecretName=AI-INTEGRATIONS-OPENAI-API-KEY)" \
    AZURE_STORAGE_CONNECTION_STRING="@Microsoft.KeyVault(VaultName=intellibid-vault;SecretName=AZURE-STORAGE-CONNECTION-STRING)" \
    AZURE_SEARCH_ENDPOINT="@Microsoft.KeyVault(VaultName=intellibid-vault;SecretName=AZURE-SEARCH-ENDPOINT)" \
    AZURE_SEARCH_KEY="@Microsoft.KeyVault(VaultName=intellibid-vault;SecretName=AZURE-SEARCH-KEY)" \
    AZURE_OPENAI_ENDPOINT="@Microsoft.KeyVault(VaultName=intellibid-vault;SecretName=AZURE-OPENAI-ENDPOINT)" \
    AZURE_OPENAI_KEY="@Microsoft.KeyVault(VaultName=intellibid-vault;SecretName=AZURE-OPENAI-KEY)" \
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT="@Microsoft.KeyVault(VaultName=intellibid-vault;SecretName=AZURE-OPENAI-EMBEDDING-DEPLOYMENT)"
```

---

## ⚠️ IMPORTANT: Production Security Checklist

Before deploying to production, update these variables:

### **1. Replace OpenAI API Key**
```bash
# Current (Replit proxy - won't work in production):
AI_INTEGRATIONS_OPENAI_API_KEY='_DUMMY_API_KEY_'

# Production (get from https://platform.openai.com/api-keys):
AI_INTEGRATIONS_OPENAI_API_KEY='sk-proj-your-real-key-here'
```

### **2. Update OpenAI Base URL**
```bash
# Current (Replit proxy):
AI_INTEGRATIONS_OPENAI_BASE_URL='http://localhost:1106/modelfarm/openai'

# Production:
AI_INTEGRATIONS_OPENAI_BASE_URL='https://api.openai.com/v1'
```

### **3. Generate New Session Secret**
```bash
# Generate a new random secret for production
openssl rand -base64 32
```

### **4. Update Database URL (if using Azure PostgreSQL)**
```bash
# Current (Neon):
postgresql://user:pass@ep-xxx.neon.tech/neondb

# Azure PostgreSQL:
postgresql://username@servername:password@servername.postgres.database.azure.com:5432/intellibid?sslmode=require
```

### **5. Rotate Azure Keys**
For maximum security, generate new keys in Azure Portal:
- **Storage Account** → Access Keys → Regenerate key1
- **AI Search** → Keys → Regenerate Primary Key
- **Azure OpenAI** → Keys and Endpoint → Regenerate Key 1

---

## 🧪 Testing Your Setup

After setting environment variables:

```bash
# 1. Verify all variables are set
env | grep -E '(NODE_ENV|DATABASE_URL|AI_INTEGRATIONS|AZURE_)' | wc -l
# Should show: 13 variables

# 2. Test database connection
psql "$DATABASE_URL" -c "SELECT version();"

# 3. Test database schema sync
npm run db:push

# 4. Build the application
npm run build

# 5. Start the server
npm start

# 6. Test the server (in another terminal)
curl http://localhost:5000/api/health || curl http://localhost:5000
```

---

## 🔍 Troubleshooting

### **Script Warning: "psql command not found"**

The script needs PostgreSQL client to fetch Azure credentials from database.

**Solution:**
```bash
# Ubuntu/Debian
sudo apt-get update && sudo apt-get install postgresql-client

# macOS
brew install postgresql

# Or manually fetch from database using secure env vars (never put password in command line!)
export PGHOST="${PGHOST}"
export PGPORT="${PGPORT}"
export PGUSER="${PGUSER}"
export PGPASSWORD="${PGPASSWORD}"
export PGDATABASE="${PGDATABASE}"
psql -t -c "SELECT key, value FROM system_config WHERE key LIKE 'AZURE%';"
```

**Security Note**: The script uses environment variables (PGHOST, PGUSER, PGPASSWORD, etc.) instead of connection strings to prevent credentials from appearing in process listings (`ps aux`).

### **Database connection fails**
```bash
# Test connection
psql "$DATABASE_URL" -c "SELECT 1;"

# Common issues:
# - Firewall blocking port 5432
# - IP not whitelisted in database firewall
# - Wrong credentials
```

### **Azure Key Vault access denied**
```bash
# Check Managed Identity is enabled
az webapp identity show --name intellibid-app --resource-group intellibid-rg

# Verify Key Vault permissions
az keyvault show --name intellibid-vault --resource-group intellibid-rg
```

---

## 🛡️ Security Best Practices

### **DO:**
✅ Use Azure Key Vault for production secrets  
✅ Use systemd EnvironmentFile with restrictive permissions (600)  
✅ Rotate keys regularly (every 90 days)  
✅ Use environment-specific configurations (dev/staging/prod)  
✅ Enable SSL/TLS for all database connections  
✅ Use Managed Identity in Azure (passwordless!)  
✅ Audit secret access via Azure Monitor  

### **DON'T:**
❌ Store secrets in `.bashrc`, `.profile`, or `/etc/environment` (world-readable!)  
❌ Display secrets in shared terminals  
❌ Commit `.env` files to version control  
❌ Share credentials via email, chat, or screenshots  
❌ Use production credentials in development  
❌ Leave default/demo credentials in production  
❌ Store secrets in application code  

---

## 📚 Additional Resources

- **Azure Deployment Guide**: See `AZURE_DEPLOYMENT.md`
- **Environment Template**: See `.env.template`
- **Export Script**: See `export-env-vars.sh`
- **Azure Key Vault Docs**: https://learn.microsoft.com/en-us/azure/key-vault/
- **Systemd Environment Files**: https://www.freedesktop.org/software/systemd/man/systemd.exec.html

---

Your environment is ready for secure deployment! 🚀
