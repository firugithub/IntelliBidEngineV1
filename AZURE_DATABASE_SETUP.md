# Azure PostgreSQL Database Setup Guide

Complete guide for setting up IntelliBid database in Azure PostgreSQL Flexible Server.

---

## 📋 Prerequisites

- Azure account with active subscription
- Azure CLI installed (optional, for CLI method)
- PostgreSQL client (`psql`) installed locally
- Database admin credentials

---

## 🎯 Method 1: Azure Portal (Recommended)

### Step 1: Create PostgreSQL Flexible Server

1. **Navigate to Azure Portal**: https://portal.azure.com
2. **Search** for "Azure Database for PostgreSQL flexible servers"
3. **Click** "+ Create"

**Basic Settings:**
- **Subscription**: Select your subscription
- **Resource Group**: Create new or select existing (e.g., `intellibid-rg`)
- **Server Name**: `intellibid-db-server` (must be globally unique)
- **Region**: Same as your App Service (e.g., `East US 2`)
- **PostgreSQL Version**: `16` (or latest stable)
- **Workload Type**: `Production (Medium/Large)` or `Development`

**Compute + Storage:**
- **Compute Tier**: `Burstable` (for dev/test) or `General Purpose` (for production)
- **Compute Size**: `B1ms` (1 vCore, 2 GB RAM) for dev, or `D2s_v3` (2 vCores, 8 GB RAM) for production
- **Storage**: `32 GB` (can auto-scale)
- **Backup Retention**: `7 days` minimum (production: 30 days)

**Authentication:**
- **Authentication Method**: `PostgreSQL authentication only`
- **Admin Username**: `intellibid_admin`
- **Password**: Create strong password (save securely!)

4. **Click** "Next: Networking"

**Networking Settings:**
- **Connectivity Method**: `Public access (allowed IP addresses)`
- **Firewall Rules**:
  - ✅ **Allow public access from any Azure service within Azure** (checked)
  - Add your current IP: Click "Add current client IP address"
  - Add App Service outbound IPs later (from App Service → Properties → Outbound IP addresses)

**SSL Settings:**
- **SSL Enforcement**: `Enabled` (recommended for production)
- **Minimum TLS Version**: `TLS 1.2`

5. **Click** "Review + Create" → "Create"
6. **Wait** 5-10 minutes for deployment

---

### Step 2: Get Connection Details

After deployment completes:

1. **Go to** your PostgreSQL server resource
2. **Click** "Connection strings" (left menu under Settings)
3. **Copy** the connection string:

```
postgresql://intellibid_admin:{your_password}@intellibid-db-server.postgres.database.azure.com:5432/postgres?sslmode=require
```

4. **Replace** `{your_password}` with your actual password
5. **Save** this connection string securely

**Example Connection String:**
```
postgresql://intellibid_admin:MyStr0ngP@ss!@intellibid-db-server.postgres.database.azure.com:5432/postgres?sslmode=require
```

---

### Step 3: Create IntelliBid Database

**Option A: Using Azure Cloud Shell**

1. **Click** the Cloud Shell icon (>_) in Azure Portal top bar
2. **Run** these commands:

```bash
# Set variables
SERVER_NAME="intellibid-db-server"
ADMIN_USER="intellibid_admin"
ADMIN_PASSWORD="your-password-here"

# Create database
psql "host=${SERVER_NAME}.postgres.database.azure.com port=5432 dbname=postgres user=${ADMIN_USER} password=${ADMIN_PASSWORD} sslmode=require" -c "CREATE DATABASE intellibid;"

# Verify
psql "host=${SERVER_NAME}.postgres.database.azure.com port=5432 dbname=postgres user=${ADMIN_USER} password=${ADMIN_PASSWORD} sslmode=require" -c "\l"
```

**Option B: Using Local psql**

```bash
# Set environment variables (secure method)
export PGHOST="intellibid-db-server.postgres.database.azure.com"
export PGPORT="5432"
export PGUSER="intellibid_admin"
export PGPASSWORD="your-password-here"
export PGSSLMODE="require"

# Create database
psql -d postgres -c "CREATE DATABASE intellibid;"

# Verify
psql -d postgres -c "\l"
```

---

### Step 4: Run Database Setup Scripts

**Upload scripts to Cloud Shell:**

1. **In Cloud Shell**, click "Upload/Download files" icon
2. **Upload** these files:
   - `azure-database-setup.sql`
   - `azure-database-indexes.sql`
   - `azure-database-seed.sql`

**Run scripts in order:**

```bash
# 1. Create all tables
psql "host=${SERVER_NAME}.postgres.database.azure.com port=5432 dbname=intellibid user=${ADMIN_USER} password=${ADMIN_PASSWORD} sslmode=require" -f azure-database-setup.sql

# 2. Create performance indexes
psql "host=${SERVER_NAME}.postgres.database.azure.com port=5432 dbname=intellibid user=${ADMIN_USER} password=${ADMIN_PASSWORD} sslmode=require" -f azure-database-indexes.sql

# 3. Insert seed data
psql "host=${SERVER_NAME}.postgres.database.azure.com port=5432 dbname=intellibid user=${ADMIN_USER} password=${ADMIN_PASSWORD} sslmode=require" -f azure-database-seed.sql
```

**Expected Output:**
```
✓ IntelliBid database schema created successfully!
✓ 20 tables created
✓ Performance indexes created successfully!
✓ Total indexes: 50+
✓ Seed data inserted successfully!
  - Portfolios: 6 (Aviation industry defaults)
  - RFT Templates: 3 (Standard templates)
  - System Config: 9 entries (awaiting Azure credentials)
```

---

### Step 5: Verify Database Setup

```bash
# Connect to database
psql "host=${SERVER_NAME}.postgres.database.azure.com port=5432 dbname=intellibid user=${ADMIN_USER} password=${ADMIN_PASSWORD} sslmode=require"

# Inside psql, run:
\dt          -- List all tables (should show 20 tables)
\di          -- List all indexes (should show 50+ indexes)
SELECT COUNT(*) FROM portfolios;      -- Should return 6
SELECT COUNT(*) FROM rft_templates;   -- Should return 3
SELECT COUNT(*) FROM system_config;   -- Should return 9
\q           -- Quit
```

---

### Step 6: Update DATABASE_URL in Environment

Your final `DATABASE_URL` should be:

```
postgresql://intellibid_admin:{password}@intellibid-db-server.postgres.database.azure.com:5432/intellibid?sslmode=require
```

**Update in App Service:**
1. **Go to** App Service → Configuration → Application settings
2. **Find** `DATABASE_URL`
3. **Update** value with new connection string
4. **Click** Save

---

## 🚀 Method 2: Azure CLI (Alternative)

```bash
# Variables
RESOURCE_GROUP="intellibid-rg"
LOCATION="eastus2"
SERVER_NAME="intellibid-db-server"
ADMIN_USER="intellibid_admin"
ADMIN_PASSWORD="MyStr0ngP@ss!"
DB_NAME="intellibid"

# Create resource group (if not exists)
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $SERVER_NAME \
  --location $LOCATION \
  --admin-user $ADMIN_USER \
  --admin-password $ADMIN_PASSWORD \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 16 \
  --public-access 0.0.0.0 \
  --yes

# Add firewall rule for Azure services
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name $SERVER_NAME \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Create database
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $SERVER_NAME \
  --database-name $DB_NAME

# Get connection string
az postgres flexible-server show-connection-string \
  --server-name $SERVER_NAME \
  --database-name $DB_NAME \
  --admin-user $ADMIN_USER \
  --admin-password $ADMIN_PASSWORD
```

Then follow **Step 4** above to run the setup scripts.

---

## 🔒 Security Best Practices

### 1. **Restrict Firewall Rules**

After initial setup, remove the `0.0.0.0` rule and add only specific IPs:

```bash
# Remove public access
az postgres flexible-server firewall-rule delete \
  --resource-group $RESOURCE_GROUP \
  --name $SERVER_NAME \
  --rule-name AllowAzureServices

# Add App Service outbound IPs only
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name $SERVER_NAME \
  --rule-name AppServiceIP1 \
  --start-ip-address <APP_SERVICE_IP_1> \
  --end-ip-address <APP_SERVICE_IP_1>
```

### 2. **Enable Azure AD Authentication** (Production)

1. **Go to** PostgreSQL server → Settings → Authentication
2. **Enable** "Azure Active Directory authentication"
3. **Add** Azure AD admin
4. **Use Managed Identity** for App Service connection (no passwords!)

### 3. **Private Endpoint** (High Security)

For maximum security, use Private Link instead of public access:

1. **Go to** PostgreSQL server → Networking
2. **Click** "Private endpoint"
3. **Create** private endpoint in App Service VNet
4. **Update** App Service to use private endpoint

---

## 🧪 Testing Database Connection

### From Local Machine

```bash
# Test connection
export PGHOST="intellibid-db-server.postgres.database.azure.com"
export PGPORT="5432"
export PGUSER="intellibid_admin"
export PGPASSWORD="your-password"
export PGDATABASE="intellibid"
export PGSSLMODE="require"

psql -c "SELECT version();"
psql -c "SELECT COUNT(*) FROM portfolios;"
```

### From App Service (Application Logs)

After deploying your app:

1. **Go to** App Service → Monitoring → Log stream
2. **Watch** for database connection messages
3. **Check** for any errors in connection

---

## 📊 Database Monitoring

### Enable Monitoring in Azure Portal

1. **Go to** PostgreSQL server → Monitoring → Metrics
2. **Add metrics**:
   - CPU percentage
   - Memory percentage
   - Active connections
   - Storage used

3. **Set up alerts**:
   - CPU > 80%
   - Storage > 80%
   - Failed connections

---

## 🔄 Backup & Restore

### Automated Backups

Azure PostgreSQL automatically backs up your database:
- **Frequency**: Continuous (point-in-time restore)
- **Retention**: 7 days (configurable up to 35 days)
- **Storage**: Geo-redundant (optional)

### Manual Backup

```bash
# Export entire database
pg_dump -h intellibid-db-server.postgres.database.azure.com \
        -U intellibid_admin \
        -d intellibid \
        --no-owner --no-acl \
        -F c \
        -f intellibid_backup_$(date +%Y%m%d).dump

# Restore from backup
pg_restore -h intellibid-db-server.postgres.database.azure.com \
           -U intellibid_admin \
           -d intellibid \
           --no-owner --no-acl \
           intellibid_backup_20250107.dump
```

### Point-in-Time Restore (Portal)

1. **Go to** PostgreSQL server → Overview
2. **Click** "Restore"
3. **Select** restore point (any time within retention period)
4. **Enter** new server name
5. **Click** "OK"

---

## 🛠️ Troubleshooting

### Connection Timeout

**Problem**: `timeout expired` or `connection refused`

**Solution**:
1. Check firewall rules include your IP
2. Verify SSL mode (`sslmode=require`)
3. Test from Azure Cloud Shell first

### Authentication Failed

**Problem**: `password authentication failed`

**Solution**:
1. Verify admin username is `intellibid_admin`
2. Reset password in Azure Portal if needed
3. Check for special characters in password (may need URL encoding)

### SSL Certificate Errors

**Problem**: `SSL certificate verification failed`

**Solution**:
```bash
# Download Azure PostgreSQL certificate
wget https://dl.cacerts.digicert.com/DigiCertGlobalRootCA.crt.pem

# Use in connection string
export PGSSLROOTCERT="/path/to/DigiCertGlobalRootCA.crt.pem"
export PGSSLMODE="verify-full"
```

### Slow Queries

**Problem**: Queries taking too long

**Solution**:
1. Check indexes exist: Run `azure-database-indexes.sql` again
2. Enable Query Performance Insight in Azure Portal
3. Review slow query log
4. Consider scaling up compute tier

---

## 📚 Additional Resources

- [Azure PostgreSQL Documentation](https://learn.microsoft.com/en-us/azure/postgresql/)
- [Connection String Reference](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
- [Azure Database Security Best Practices](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-security)

---

## ✅ Checklist

- [ ] PostgreSQL Flexible Server created
- [ ] Firewall rules configured
- [ ] `intellibid` database created
- [ ] Tables created (`azure-database-setup.sql`)
- [ ] Indexes created (`azure-database-indexes.sql`)
- [ ] Seed data inserted (`azure-database-seed.sql`)
- [ ] Connection tested from local machine
- [ ] `DATABASE_URL` updated in App Service
- [ ] Monitoring and alerts configured
- [ ] Backup retention configured

---

**Your database is now ready for IntelliBid deployment! 🎉**
