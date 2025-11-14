#!/bin/bash
# Azure VM Environment Setup Script for IntelliBid
# Run this script on your Azure VM to set up environment variables

echo "🚀 IntelliBid Azure VM Setup"
echo "=============================="
echo ""

# Check if running on Azure VM
if [ ! -d "/home/azureuser/IntelliBidEngineV1" ]; then
    echo "⚠️  Warning: Expected directory not found. Are you running this on the Azure VM?"
    echo "Current directory: $(pwd)"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Function to prompt for secret
prompt_secret() {
    local var_name=$1
    local description=$2
    local current_value=${!var_name}
    
    if [ -n "$current_value" ]; then
        echo "✓ $var_name is already set"
        return
    fi
    
    echo ""
    echo "📝 $description"
    read -p "Enter $var_name: " value
    
    if [ -z "$value" ]; then
        echo "⚠️  Warning: $var_name not set (left empty)"
    else
        export $var_name="$value"
        echo "export $var_name=\"$value\"" >> ~/.bashrc
        echo "✓ $var_name set"
    fi
}

echo "Setting up environment variables..."
echo ""

# Database Configuration
echo "📊 DATABASE CONFIGURATION"
echo "-------------------------"
prompt_secret "DATABASE_URL" "PostgreSQL connection string (postgresql://user:pass@host:5432/db?sslmode=require)"
prompt_secret "PGHOST" "PostgreSQL host (e.g., intellibid-db.postgres.database.azure.com)"
prompt_secret "PGPORT" "PostgreSQL port (usually 5432)"
prompt_secret "PGUSER" "PostgreSQL username"
prompt_secret "PGPASSWORD" "PostgreSQL password"
prompt_secret "PGDATABASE" "PostgreSQL database name"

# Azure OpenAI
echo ""
echo "🤖 AZURE OPENAI CONFIGURATION"
echo "------------------------------"
prompt_secret "AZURE_OPENAI_ENDPOINT" "Azure OpenAI endpoint (https://your-resource.openai.azure.com)"
prompt_secret "AZURE_OPENAI_KEY" "Azure OpenAI API key"
prompt_secret "AZURE_OPENAI_API_VERSION" "API version (e.g., 2024-02-15-preview)"
prompt_secret "AZURE_OPENAI_DEPLOYMENT" "GPT deployment name (e.g., gpt-4o)"
prompt_secret "AZURE_OPENAI_EMBEDDING_DEPLOYMENT" "Embedding deployment name (e.g., text-embedding-ada-002)"

# Azure AI Search
echo ""
echo "🔍 AZURE AI SEARCH CONFIGURATION"
echo "---------------------------------"
prompt_secret "AZURE_SEARCH_ENDPOINT" "Azure AI Search endpoint (https://your-search.search.windows.net)"
prompt_secret "AZURE_SEARCH_KEY" "Azure AI Search admin key"

# Azure Blob Storage
echo ""
echo "💾 AZURE BLOB STORAGE CONFIGURATION"
echo "------------------------------------"
prompt_secret "AZURE_STORAGE_CONNECTION_STRING" "Azure Storage connection string"

# Session Secret
echo ""
echo "🔐 SESSION CONFIGURATION"
echo "------------------------"
if [ -z "$SESSION_SECRET" ]; then
    SESSION_SECRET=$(openssl rand -base64 32)
    export SESSION_SECRET="$SESSION_SECRET"
    echo "export SESSION_SECRET=\"$SESSION_SECRET\"" >> ~/.bashrc
    echo "✓ SESSION_SECRET generated and set"
else
    echo "✓ SESSION_SECRET already set"
fi

# Optional OpenAI
echo ""
echo "🔧 OPTIONAL: OPENAI CONFIGURATION (if using non-Azure OpenAI)"
echo "--------------------------------------------------------------"
read -p "Do you want to configure OpenAI? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    prompt_secret "AI_INTEGRATIONS_OPENAI_API_KEY" "OpenAI API key (sk-...)"
    prompt_secret "AI_INTEGRATIONS_OPENAI_BASE_URL" "OpenAI base URL (https://api.openai.com/v1)"
fi

echo ""
echo "================================"
echo "✅ Environment setup complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Reload environment: source ~/.bashrc"
echo "2. Navigate to app: cd /home/azureuser/IntelliBidEngineV1"
echo "3. Restart application: pm2 restart all"
echo ""
echo "To verify database connection:"
echo "  npm run db:test"
echo ""
echo "To view logs:"
echo "  pm2 logs intellibid"
echo ""
