# 🚨 Azure VM Quick Fix - Database Password Error

## Your Error
```
Error: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
```

## Immediate Fix (5 minutes)

### Step 1: SSH into Your Azure VM
```bash
ssh azureuser@<your-vm-ip-address>
```

### Step 2: Navigate to Your App Directory
```bash
cd /home/azureuser/IntelliBidEngineV1
```

### Step 3: Create Environment File
```bash
nano .env.production
```

### Step 4: Add Your Database Connection
**Copy and paste this template, then replace the values:**

```bash
# REQUIRED: Database Configuration
DATABASE_URL=postgresql://YOUR_USERNAME:YOUR_PASSWORD@YOUR_DB_HOST:5432/YOUR_DATABASE?sslmode=require

# Example for Azure PostgreSQL:
# DATABASE_URL=postgresql://intellibid_admin:MyPassword123!@intellibid-db.postgres.database.azure.com:5432/intellibid?sslmode=require

# REQUIRED: Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_KEY=your-azure-openai-key-here
AZURE_OPENAI_API_VERSION=2024-02-15-preview
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002

# REQUIRED: Azure AI Search
AZURE_SEARCH_ENDPOINT=https://your-search-service.search.windows.net
AZURE_SEARCH_KEY=your-search-admin-key

# REQUIRED: Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=youraccount;AccountKey=yourkey;EndpointSuffix=core.windows.net

# REQUIRED: Session Secret (generate random string)
SESSION_SECRET=your-long-random-secret-string-here

# Optional: GitHub PAT (if needed)
GITHUB_PAT=ghp_your_token_here

# Production Mode
NODE_ENV=production
PORT=5000
```

**Save:** Press `Ctrl+X`, then `Y`, then `Enter`

### Step 5: Load Environment Variables
```bash
# Export all variables from .env.production
set -a
source .env.production
set +a
```

### Step 6: Test Database Connection
```bash
# Quick database test
node -e "const { Pool } = require('pg'); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query('SELECT NOW() as now').then(result => { console.log('✅ Database connected:', result.rows[0].now); process.exit(0); }).catch(err => { console.error('❌ Database error:', err.message); process.exit(1); });"
```

**Expected output:** `✅ Database connected: <timestamp>`

### Step 7: Start Your Application

**Option A: Using PM2 (Recommended)**
```bash
# Install PM2 if not already installed
npm install -g pm2

# Start the app with environment variables
pm2 start dist/index.js --name intellibid --env production

# Save PM2 config
pm2 save

# Setup PM2 to restart on reboot
pm2 startup
```

**Option B: Using Node directly**
```bash
# Start with environment variables
NODE_ENV=production node dist/index.js
```

**Option C: Using a startup script**
```bash
# Create startup script
cat > start.sh << 'EOF'
#!/bin/bash
set -a
source .env.production
set +a
NODE_ENV=production node dist/index.js
EOF

chmod +x start.sh
./start.sh
```

### Step 8: Verify Application is Running
```bash
# Check if app is listening
curl http://localhost:5000/api/projects

# Check PM2 status
pm2 status

# View logs
pm2 logs intellibid --lines 50
```

## Important: Password Special Characters

If your database password contains special characters, you need to URL-encode them in the DATABASE_URL:

| Character | Encoded |
|-----------|---------|
| `@`       | `%40`   |
| `:`       | `%3A`   |
| `/`       | `%2F`   |
| `?`       | `%3F`   |
| `#`       | `%23`   |
| `&`       | `%26`   |
| `=`       | `%3D`   |
| `+`       | `%2B`   |
| `%`       | `%25`   |
| ` ` (space) | `%20` |

**Example:**
- Original password: `P@ss:word!123`
- Encoded password: `P%40ss%3Aword!123`
- Full URL: `postgresql://user:P%40ss%3Aword!123@host:5432/db?sslmode=require`

## Troubleshooting

### Still getting password error?
```bash
# Check if DATABASE_URL is set correctly
echo $DATABASE_URL

# Check if it has a password
echo $DATABASE_URL | grep -o '://[^:]*:[^@]*@'
```

### Can't connect to database?
```bash
# Test network connectivity
nc -zv your-db-host.postgres.database.azure.com 5432

# Check PostgreSQL logs in Azure Portal
# Azure Portal → Your PostgreSQL Server → Logs
```

### App won't start?
```bash
# Check if port 5000 is already in use
lsof -i :5000

# Kill process using port 5000
kill -9 $(lsof -t -i:5000)

# Check all environment variables
printenv | grep -E "(DATABASE|AZURE|SESSION)" | sort
```

### PM2 not starting?
```bash
# Remove old PM2 processes
pm2 delete all

# Clear PM2 logs
pm2 flush

# Start fresh
pm2 start dist/index.js --name intellibid
```

## Next Steps After Fix

1. **Set up nginx reverse proxy** (to use port 80/443)
2. **Configure SSL certificate** (Let's Encrypt)
3. **Set up log rotation** for PM2
4. **Configure firewall rules** in Azure
5. **Enable monitoring** with Azure Application Insights

## Where to Get Your Credentials

### Database (Azure PostgreSQL)
- Azure Portal → PostgreSQL servers → Your server
- Connection strings → Node.js
- Username format: `username@servername`
- Reset password if forgotten

### Azure OpenAI
- Azure Portal → Azure OpenAI → Your resource
- Keys and Endpoint → Copy KEY 1 and Endpoint

### Azure AI Search
- Azure Portal → Search services → Your service
- Keys → Copy Primary admin key

### Azure Storage
- Azure Portal → Storage accounts → Your storage
- Access keys → Copy connection string

## Security Warning

⚠️ **Never commit `.env.production` to Git!**

Add to `.gitignore`:
```bash
echo ".env.production" >> .gitignore
```

## Still Stuck?

Check these logs:
```bash
# PM2 logs
pm2 logs intellibid --lines 100

# System logs
journalctl -u intellibid -n 100

# Application logs
tail -f /home/azureuser/IntelliBidEngineV1/logs/*.log
```

## Quick Reference Commands

```bash
# Restart app
pm2 restart intellibid

# View logs
pm2 logs intellibid

# Stop app
pm2 stop intellibid

# Check status
pm2 status

# Monitor in real-time
pm2 monit
```
