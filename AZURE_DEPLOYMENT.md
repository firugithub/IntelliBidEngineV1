# 🚀 IntelliBid - Azure Deployment Guide

This guide will help you deploy IntelliBid to Microsoft Azure using best practices for production environments.

---

## 📋 Prerequisites

- **Azure Account** with active subscription ([Free tier available](https://azure.microsoft.com/free))
- **Azure CLI** installed ([Download](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli))
- **Git** installed
- **Node.js 18+** installed locally

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Azure Resources                        │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────┐      ┌──────────────────────┐  │
│  │   App Service       │──────│  PostgreSQL          │  │
│  │   (B1 or higher)    │      │  Flexible Server     │  │
│  │   Port: 5000        │      │  (B1MS recommended)  │  │
│  └─────────────────────┘      └──────────────────────┘  │
│            │                                              │
│            ├───────────────┬──────────────┬──────────────┤
│            │               │              │              │
│  ┌─────────▼─────────┐ ┌──▼────────┐ ┌──▼──────────┐   │
│  │  Azure Key Vault  │ │  Blob     │ │  AI Search  │   │
│  │  (Secrets Mgmt)   │ │  Storage  │ │  (RAG)      │   │
│  └───────────────────┘ └───────────┘ └─────────────┘   │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │          Azure OpenAI (Embeddings)                 │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Deployment (5 Steps)

### **Step 1: Login to Azure**

```bash
# Login to Azure
az login

# Set your subscription (if you have multiple)
az account set --subscription "Your Subscription Name"

# Create a resource group
az group create \
  --name intellibid-rg \
  --location eastus
```

---

### **Step 2: Create PostgreSQL Database**

```bash
# Create PostgreSQL Flexible Server
az postgres flexible-server create \
  --name intellibid-db \
  --resource-group intellibid-rg \
  --location eastus \
  --admin-user intellibidadmin \
  --admin-password "YourSecurePassword123!" \
  --sku-name Standard_B1ms \
  --storage-size 32 \
  --version 14 \
  --public-access 0.0.0.0

# Create database
az postgres flexible-server db create \
  --resource-group intellibid-rg \
  --server-name intellibid-db \
  --database-name intellibid

# Get connection string
az postgres flexible-server show-connection-string \
  --server-name intellibid-db \
  --database-name intellibid \
  --admin-user intellibidadmin \
  --admin-password "YourSecurePassword123!"
```

**Save the connection string** - you'll need it in Step 4.

---

### **Step 3: Create App Service**

```bash
# Create App Service Plan (B1 = Basic tier, ~$13/month)
az appservice plan create \
  --name intellibid-plan \
  --resource-group intellibid-rg \
  --location eastus \
  --sku B1 \
  --is-linux

# Create Web App
az webapp create \
  --name intellibid-app \
  --resource-group intellibid-rg \
  --plan intellibid-plan \
  --runtime "NODE:18-lts"
```

---

### **Step 4: Create Azure Key Vault & Store Secrets**

```bash
# Create Key Vault
az keyvault create \
  --name intellibid-vault \
  --resource-group intellibid-rg \
  --location eastus

# Enable Managed Identity for App Service
az webapp identity assign \
  --name intellibid-app \
  --resource-group intellibid-rg

# Get the Managed Identity ID (save this)
IDENTITY_ID=$(az webapp identity show \
  --name intellibid-app \
  --resource-group intellibid-rg \
  --query principalId -o tsv)

# Grant Key Vault access to App Service
az keyvault set-policy \
  --name intellibid-vault \
  --object-id $IDENTITY_ID \
  --secret-permissions get list

# Store secrets in Key Vault
az keyvault secret set --vault-name intellibid-vault \
  --name "DATABASE-URL" \
  --value "postgresql://intellibidadmin:YourSecurePassword123!@intellibid-db.postgres.database.azure.com:5432/intellibid?sslmode=require"

az keyvault secret set --vault-name intellibid-vault \
  --name "OPENAI-API-KEY" \
  --value "your-openai-api-key-here"

az keyvault secret set --vault-name intellibid-vault \
  --name "SESSION-SECRET" \
  --value "$(openssl rand -base64 32)"

# Add Azure service credentials (if not already in Admin Config)
az keyvault secret set --vault-name intellibid-vault \
  --name "AZURE-STORAGE-CONNECTION-STRING" \
  --value "your-azure-storage-connection-string"

az keyvault secret set --vault-name intellibid-vault \
  --name "AZURE-SEARCH-ENDPOINT" \
  --value "https://your-search-service.search.windows.net"

az keyvault secret set --vault-name intellibid-vault \
  --name "AZURE-SEARCH-KEY" \
  --value "your-search-admin-key"

az keyvault secret set --vault-name intellibid-vault \
  --name "AZURE-OPENAI-ENDPOINT" \
  --value "https://your-openai.openai.azure.com"

az keyvault secret set --vault-name intellibid-vault \
  --name "AZURE-OPENAI-KEY" \
  --value "your-azure-openai-key"

az keyvault secret set --vault-name intellibid-vault \
  --name "AZURE-OPENAI-EMBEDDING-DEPLOYMENT" \
  --value "text-embedding-ada-002"
```

---

### **Step 5: Configure App Service Environment Variables**

```bash
# Set environment variables with Key Vault references
az webapp config appsettings set \
  --name intellibid-app \
  --resource-group intellibid-rg \
  --settings \
    NODE_ENV="production" \
    PORT="5000" \
    DATABASE_URL="@Microsoft.KeyVault(VaultName=intellibid-vault;SecretName=DATABASE-URL)" \
    AI_INTEGRATIONS_OPENAI_API_KEY="@Microsoft.KeyVault(VaultName=intellibid-vault;SecretName=OPENAI-API-KEY)" \
    SESSION_SECRET="@Microsoft.KeyVault(VaultName=intellibid-vault;SecretName=SESSION-SECRET)" \
    AZURE_STORAGE_CONNECTION_STRING="@Microsoft.KeyVault(VaultName=intellibid-vault;SecretName=AZURE-STORAGE-CONNECTION-STRING)" \
    AZURE_SEARCH_ENDPOINT="@Microsoft.KeyVault(VaultName=intellibid-vault;SecretName=AZURE-SEARCH-ENDPOINT)" \
    AZURE_SEARCH_KEY="@Microsoft.KeyVault(VaultName=intellibid-vault;SecretName=AZURE-SEARCH-KEY)" \
    AZURE_OPENAI_ENDPOINT="@Microsoft.KeyVault(VaultName=intellibid-vault;SecretName=AZURE-OPENAI-ENDPOINT)" \
    AZURE_OPENAI_KEY="@Microsoft.KeyVault(VaultName=intellibid-vault;SecretName=AZURE-OPENAI-KEY)" \
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT="@Microsoft.KeyVault(VaultName=intellibid-vault;SecretName=AZURE-OPENAI-EMBEDDING-DEPLOYMENT)"

# Configure startup command
az webapp config set \
  --name intellibid-app \
  --resource-group intellibid-rg \
  --startup-file "node dist/index.js"
```

---

## 📦 Deployment Options

### **Option A: GitHub Actions (Recommended for CI/CD)**

1. **Get Publish Profile**:
   ```bash
   az webapp deployment list-publishing-profiles \
     --name intellibid-app \
     --resource-group intellibid-rg \
     --xml
   ```

2. **Add to GitHub Secrets**:
   - Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
   - Create secret: `AZURE_WEBAPP_PUBLISH_PROFILE`
   - Paste the XML content

3. **Create Workflow File** (`.github/workflows/azure-deploy.yml`):

```yaml
name: Deploy IntelliBid to Azure

on:
  push:
    branches: [ main ]
  workflow_dispatch:

env:
  AZURE_WEBAPP_NAME: intellibid-app
  NODE_VERSION: '18.x'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
      
      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v2
        with:
          app-name: ${{ env.AZURE_WEBAPP_NAME }}
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: .
```

4. **Push to GitHub** - deployment will happen automatically!

---

### **Option B: Local Git Deployment**

```bash
# Configure local git deployment
az webapp deployment source config-local-git \
  --name intellibid-app \
  --resource-group intellibid-rg

# Get git URL (save this)
GIT_URL=$(az webapp deployment source config-local-git \
  --name intellibid-app \
  --resource-group intellibid-rg \
  --query url -o tsv)

# Set deployment credentials
az webapp deployment user set \
  --user-name intellibid-deployer \
  --password "SecureDeployPassword123!"

# Add Azure as git remote
git remote add azure $GIT_URL

# Build and deploy
npm run build
git add .
git commit -m "Deploy to Azure"
git push azure main
```

---

### **Option C: Azure CLI Direct Upload**

```bash
# Build the application
npm run build

# Create a deployment package
zip -r deploy.zip dist node_modules package.json package-lock.json

# Deploy to Azure
az webapp deployment source config-zip \
  --name intellibid-app \
  --resource-group intellibid-rg \
  --src deploy.zip
```

---

## 🗄️ Database Migration

After first deployment, run database migrations:

```bash
# Set the DATABASE_URL locally (temporary)
export DATABASE_URL="postgresql://intellibidadmin:YourSecurePassword123!@intellibid-db.postgres.database.azure.com:5432/intellibid?sslmode=require"

# Push database schema
npm run db:push

# Or if you get warnings about data loss:
npm run db:push -- --force
```

**Alternative**: Run migrations via Azure Cloud Shell or App Service SSH console.

---

## 🔧 Post-Deployment Configuration

### **1. Configure CORS (if needed)**

```bash
az webapp cors add \
  --name intellibid-app \
  --resource-group intellibid-rg \
  --allowed-origins "https://yourdomain.com"
```

### **2. Enable Application Insights (Monitoring)**

```bash
az monitor app-insights component create \
  --app intellibid-insights \
  --location eastus \
  --resource-group intellibid-rg \
  --application-type web

# Get instrumentation key
INSIGHTS_KEY=$(az monitor app-insights component show \
  --app intellibid-insights \
  --resource-group intellibid-rg \
  --query instrumentationKey -o tsv)

# Link to App Service
az webapp config appsettings set \
  --name intellibid-app \
  --resource-group intellibid-rg \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY=$INSIGHTS_KEY
```

### **3. Configure Custom Domain (Optional)**

```bash
# Add custom domain
az webapp config hostname add \
  --webapp-name intellibid-app \
  --resource-group intellibid-rg \
  --hostname "www.yourdomain.com"

# Enable HTTPS with managed certificate (free)
az webapp config ssl bind \
  --name intellibid-app \
  --resource-group intellibid-rg \
  --certificate-thumbprint auto \
  --ssl-type SNI
```

---

## 🔍 Troubleshooting

### **View Logs**

```bash
# Stream live logs
az webapp log tail \
  --name intellibid-app \
  --resource-group intellibid-rg

# Download logs
az webapp log download \
  --name intellibid-app \
  --resource-group intellibid-rg \
  --log-file logs.zip
```

### **SSH into App Service**

```bash
# Enable SSH
az webapp create-remote-connection \
  --name intellibid-app \
  --resource-group intellibid-rg
```

### **Common Issues**

| Issue | Solution |
|-------|----------|
| **502 Bad Gateway** | Check startup command: `node dist/index.js` |
| **Database connection fails** | Verify firewall rules allow Azure services |
| **Key Vault access denied** | Ensure Managed Identity has proper permissions |
| **Build fails** | Run `npm run build` locally to test |

---

## 💰 Cost Estimation

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| App Service | B1 (Basic) | ~$13 |
| PostgreSQL | B1ms (Burstable) | ~$12 |
| Key Vault | Standard | ~$0.03 |
| Blob Storage | 10 GB | ~$0.20 |
| AI Search | Basic | ~$75 |
| Azure OpenAI | Pay-per-use | Variable |
| **Total (approx)** | | **~$100-150/month** |

💡 **Free Tier Options**: Azure offers 12 months free for many services. Check [Azure Free Account](https://azure.microsoft.com/free).

---

## 🎯 Production Checklist

- [ ] Enable HTTPS (automatic with App Service)
- [ ] Configure custom domain
- [ ] Set up Application Insights monitoring
- [ ] Configure auto-scaling (if needed)
- [ ] Set up automated backups for PostgreSQL
- [ ] Configure deployment slots for staging
- [ ] Enable Azure Front Door (CDN) for global performance
- [ ] Set up Azure Monitor alerts
- [ ] Review and optimize costs
- [ ] Document your deployment for your team

---

## 📚 Useful Commands

```bash
# Restart app
az webapp restart --name intellibid-app --resource-group intellibid-rg

# View app URL
az webapp show --name intellibid-app --resource-group intellibid-rg --query defaultHostName -o tsv

# Update environment variable
az webapp config appsettings set \
  --name intellibid-app \
  --resource-group intellibid-rg \
  --settings NEW_VAR="value"

# Scale up (change tier)
az appservice plan update \
  --name intellibid-plan \
  --resource-group intellibid-rg \
  --sku S1

# Delete all resources (cleanup)
az group delete --name intellibid-rg --yes
```

---

## 🔗 Additional Resources

- [Azure App Service Docs](https://learn.microsoft.com/en-us/azure/app-service/)
- [Azure PostgreSQL Docs](https://learn.microsoft.com/en-us/azure/postgresql/)
- [Azure Key Vault Best Practices](https://learn.microsoft.com/en-us/azure/key-vault/general/best-practices)
- [Azure Cost Management](https://azure.microsoft.com/en-us/pricing/calculator/)

---

## ✅ Your App is Live!

Once deployed, your IntelliBid application will be available at:

```
https://intellibid-app.azurewebsites.net
```

All your existing Azure services (Blob Storage, AI Search, OpenAI) will continue to work seamlessly! 🎉
