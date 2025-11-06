# Azure Configuration Backup & Restore

**Backup Date:** November 6, 2025  
**Backup Table:** `azure_config_backup_20251106`

## Current Configuration (Backed Up)

| Key | Category | Endpoint/Value |
|-----|----------|----------------|
| AZURE_OPENAI_ENDPOINT | azure_openai | https://aifoundryib.cognitiveservices.azure.com/ |
| AZURE_OPENAI_EMBEDDING_DEPLOYMENT | azure_openai | text-embedding-3-small |
| AZURE_OPENAI_KEY | azure_openai | ***ENCRYPTED*** |
| AZURE_SEARCH_ENDPOINT | azure_search | https://aisearchintellibid.search.windows.net |
| AZURE_SEARCH_KEY | azure_search | ***ENCRYPTED*** |
| AZURE_STORAGE_CONNECTION_STRING | azure_storage | ***ENCRYPTED*** |

---

## How to Restore Old Configuration

### Method 1: Using Database (Recommended - Fastest)

Run this SQL command in your database:

```sql
-- Restore all Azure configuration from backup
DELETE FROM system_config WHERE category IN ('azure_openai', 'azure_search', 'azure_storage');

INSERT INTO system_config 
SELECT * FROM azure_config_backup_20251106;

-- Verify restoration
SELECT key, category, description, 
  CASE WHEN is_encrypted = 'true' THEN '***ENCRYPTED***' ELSE value END as display_value
FROM system_config 
WHERE category IN ('azure_openai', 'azure_search', 'azure_storage')
ORDER BY category, key;
```

**After running this:**
1. Restart your application
2. Azure services will reconnect to old subscription automatically

---

### Method 2: Using Admin Config Page (Manual)

If the database restore doesn't work, manually re-enter these values in Admin Config:

**Azure OpenAI:**
- Endpoint: `https://aifoundryib.cognitiveservices.azure.com/`
- Embedding Deployment: `text-embedding-3-small`
- API Key: (retrieve from Azure Portal → Cognitive Services → Keys)

**Azure AI Search:**
- Endpoint: `https://aisearchintellibid.search.windows.net`
- API Key: (retrieve from Azure Portal → AI Search → Keys)

**Azure Blob Storage:**
- Connection String: (retrieve from Azure Portal → Storage Account → Access Keys)

---

## Testing After Restore

1. Visit: `https://your-app.replit.app/api/health/azure-storage`
2. Should see: `"status": "connected"`

---

## Backup Retention

The backup table `azure_config_backup_20251106` will remain in your database until manually deleted.

**To view backup at any time:**
```sql
SELECT * FROM azure_config_backup_20251106;
```

**To delete backup when no longer needed:**
```sql
DROP TABLE azure_config_backup_20251106;
```
