# Database Setup Guide for Azure PostgreSQL

This guide explains how to initialize your IntelliBid database schema on Azure PostgreSQL.

## Prerequisites

- Azure PostgreSQL database created
- DATABASE_URL environment variable (connection string with private endpoint)
- Node.js and npm installed

## Option 1: Interactive Setup (Recommended for Local)

Use the interactive bash script to set up the database from your local machine:

```bash
# Set your Azure PostgreSQL connection string
export DATABASE_URL='postgresql://user:password@ibidpostgressserver.postgres.database.azure.com:5432/intellibid?sslmode=require'

# Run the setup script
./setup-database.sh
```

The script will:
1. Verify DATABASE_URL is set
2. Test database connectivity
3. Ask for confirmation
4. Deploy the schema using Drizzle

---

## Option 2: Automated Setup (For Docker/CI/CD)

Use the Node.js script for automated initialization without prompts:

```bash
# From your local machine or CI/CD pipeline
DATABASE_URL='postgresql://...' node init-db.js
```

Or from within the Docker container:

```bash
# SSH into your Azure App Service container
docker exec -it <container> sh

# Run initialization
node init-db.js
```

---

## Option 3: Manual Schema Push

If you prefer to run Drizzle commands directly:

```bash
# Set DATABASE_URL
export DATABASE_URL='postgresql://...'

# Push schema to database
npm run db:push

# Or force push if you get warnings
npm run db:push -- --force
```

---

## What Gets Created

The setup scripts will create all tables defined in `shared/schema.ts`:

- **Core Entities**: Projects, Portfolios, RFTs, RFI Sections
- **Vendor Management**: Vendors, Proposals, Evaluations
- **Document Management**: RFT Drafts, RFT Packs, Templates
- **AI Analysis**: Agent Metrics, Evaluation Results
- **Knowledge Base**: RAG Documents

---

## Verifying the Setup

After running the setup, verify tables were created:

```sql
-- Connect to your database and run:
\dt

-- Should show all IntelliBid tables
```

Or check from your application:
1. Start the application
2. Access the Admin Config page
3. Click "Test Database Connection"

---

## Troubleshooting

### "DATABASE_URL is not set"
Make sure you've exported the environment variable:
```bash
export DATABASE_URL='postgresql://...'
```

### "Connection timeout"
If using private endpoint:
- Verify VNet integration is enabled
- Check WEBSITE_DNS_SERVER=168.63.129.16 is set
- Ensure Private DNS zone is linked to VNet

### "Permission denied"
Your PostgreSQL user needs:
- CREATE TABLE permissions
- CREATE INDEX permissions
- ALTER TABLE permissions

Grant permissions:
```sql
GRANT ALL PRIVILEGES ON DATABASE intellibid TO your_user;
GRANT ALL ON SCHEMA public TO your_user;
```

---

## Production Deployment

For Azure App Service with Docker:

1. **Ensure DATABASE_URL is in App Service Configuration**
   - Go to App Service → Configuration → Application settings
   - Add DATABASE_URL with your connection string

2. **Run initialization on first deployment:**

   **Option A**: Add to startup command
   ```bash
   sh -c 'node init-db.js && /startup.sh'
   ```

   **Option B**: Run manually after deployment
   ```bash
   # Via Azure Cloud Shell
   az webapp ssh -n <app-name> -g <resource-group>
   node init-db.js
   ```

3. **Schema updates**
   - Update `shared/schema.ts` with new fields
   - Run `npm run db:push` locally or via init-db.js
   - Changes are automatically detected and applied

---

## Schema Management

IntelliBid uses **Drizzle ORM** for schema management:

- **Schema Definition**: `shared/schema.ts`
- **Migration History**: `migrations/` directory
- **Push Changes**: `npm run db:push` (no manual SQL migrations needed)
- **Configuration**: `drizzle.config.ts`

### Making Schema Changes

1. Edit `shared/schema.ts`
2. Run `npm run db:push` to sync with database
3. Drizzle automatically generates and applies changes
4. No manual migration files needed!

---

## Security Notes

- Never commit DATABASE_URL to git
- Use Azure Key Vault or App Service Configuration for secrets
- Always use SSL/TLS (`sslmode=require` in connection string)
- Prefer private endpoints over public access for production

---

## Need Help?

- **Database Connection Issues**: Check Azure PostgreSQL firewall rules
- **Schema Issues**: Review `shared/schema.ts` for table definitions
- **Migration Failures**: Use `npm run db:push -- --force` to force sync
- **Private Endpoint Issues**: See main README for VNet setup guide
