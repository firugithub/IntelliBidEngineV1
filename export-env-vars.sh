#!/bin/bash

# ====================================================
# IntelliBid Environment Variables Export Script
# ====================================================
# ⚠️ SECURITY WARNING:
# This script generates export commands containing SENSITIVE CREDENTIALS
# Only run this in a SECURE, TRUSTED environment
# 
# RECOMMENDED USAGE:
#   ./export-env-vars.sh --output /secure/path/env-file.sh
#   source /secure/path/env-file.sh
#   rm /secure/path/env-file.sh
#
# FOR AZURE DEPLOYMENT:
#   Use Azure Key Vault instead of this script (see ENV_SETUP_GUIDE.md)
# ====================================================

set -euo pipefail

# Set restrictive umask to prevent world-readable files
umask 077

# Default output file (secure temp file)
OUTPUT_FILE=""
SHOW_HELP=false
FORCE_STDOUT=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --output|-o)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    --stdout)
      FORCE_STDOUT=true
      shift
      ;;
    --help|-h)
      SHOW_HELP=true
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Use --help for usage information" >&2
      exit 1
      ;;
  esac
done

# Show help
if [ "$SHOW_HELP" = true ]; then
  cat << 'EOF'
IntelliBid Environment Variables Export Script

USAGE:
  ./export-env-vars.sh [OPTIONS]

OPTIONS:
  --output, -o FILE    Write to specified file (creates with 600 permissions)
  --stdout             Force output to terminal (INSECURE, requires confirmation)
  --help, -h           Show this help message

EXAMPLES:
  # Secure: Write to file (recommended)
  ./export-env-vars.sh --output /tmp/env-secure.sh
  source /tmp/env-secure.sh
  rm /tmp/env-secure.sh

  # Secure: Auto-generated temp file
  ./export-env-vars.sh
  (follow on-screen instructions)

  # INSECURE: Display in terminal (not recommended)
  ./export-env-vars.sh --stdout

SECURITY:
  - Files are created with restrictive permissions (600)
  - Umask is set to 077 to prevent world-readable files
  - Terminal output requires explicit confirmation
  - Use Azure Key Vault for production deployments

EOF
  exit 0
fi

# Function to generate environment variables
generate_env_vars() {
  local output_fd=$1
  
  # Output header
  cat >&$output_fd << 'EOF'
# ======================================================
# IntelliBid Production Environment Variables
# ======================================================
# ⚠️ CONFIDENTIAL - Contains sensitive credentials
# Delete this file after use
# ======================================================

EOF

  # Application Core
  echo "# Application Settings" >&$output_fd
  echo "export NODE_ENV=production" >&$output_fd
  echo "export PORT=5000" >&$output_fd
  echo "" >&$output_fd

  # Session Secret
  if [ -z "${SESSION_SECRET:-}" ]; then
    echo "# ⚠️  SESSION_SECRET not found in environment!" >&$output_fd
    echo "# Generate one: export SESSION_SECRET=\$(openssl rand -base64 32)" >&$output_fd
    echo "export SESSION_SECRET='MISSING-GENERATE-NEW-SECRET'" >&$output_fd
  else
    echo "# Security (⚠️ Generate NEW secret for production!)" >&$output_fd
    echo "export SESSION_SECRET='${SESSION_SECRET}'" >&$output_fd
  fi
  echo "" >&$output_fd

  # Database
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "# ⚠️  DATABASE_URL not found in environment!" >&$output_fd
    echo "export DATABASE_URL='postgresql://username:password@host:5432/database'" >&$output_fd
  else
    echo "# PostgreSQL Database" >&$output_fd
    echo "export DATABASE_URL='${DATABASE_URL}'" >&$output_fd
    echo "export PGHOST='${PGHOST:-}'" >&$output_fd
    echo "export PGPORT='${PGPORT:-5432}'" >&$output_fd
    echo "export PGUSER='${PGUSER:-}'" >&$output_fd
    echo "export PGPASSWORD='${PGPASSWORD:-}'" >&$output_fd
    echo "export PGDATABASE='${PGDATABASE:-}'" >&$output_fd
  fi
  echo "" >&$output_fd

  # OpenAI
  if [ -z "${AI_INTEGRATIONS_OPENAI_API_KEY:-}" ]; then
    echo "# ⚠️  OpenAI API key not found!" >&$output_fd
    echo "export AI_INTEGRATIONS_OPENAI_API_KEY='sk-YOUR-KEY-HERE'" >&$output_fd
  else
    echo "# OpenAI API (⚠️ Replace _DUMMY_API_KEY_ with real key for production!)" >&$output_fd
    echo "export AI_INTEGRATIONS_OPENAI_API_KEY='${AI_INTEGRATIONS_OPENAI_API_KEY}'" >&$output_fd
    echo "export AI_INTEGRATIONS_OPENAI_BASE_URL='${AI_INTEGRATIONS_OPENAI_BASE_URL:-https://api.openai.com/v1}'" >&$output_fd
    if [ "${AI_INTEGRATIONS_OPENAI_BASE_URL:-}" == "http://localhost:1106/modelfarm/openai" ]; then
      echo "# ⚠️  For production, change to: export AI_INTEGRATIONS_OPENAI_BASE_URL='https://api.openai.com/v1'" >&$output_fd
    fi
  fi
  echo "" >&$output_fd

  # Azure configuration from database
  echo "# Azure Services Configuration" >&$output_fd
  
  # Check if psql is available
  if ! command -v psql &> /dev/null; then
    cat >&$output_fd << 'EOF'
# ⚠️  WARNING: psql command not found!
# Cannot automatically fetch Azure credentials from database.
#
# MANUAL STEPS REQUIRED:
# 1. Install PostgreSQL client:
#    - Ubuntu/Debian: sudo apt-get install postgresql-client
#    - macOS: brew install postgresql
# 2. Or manually fetch from database:
#    psql "$DATABASE_URL" -c "SELECT key, value FROM system_config WHERE key LIKE 'AZURE%';"

EOF
    echo "export AZURE_STORAGE_CONNECTION_STRING='<FETCH FROM DATABASE>'" >&$output_fd
    echo "export AZURE_SEARCH_ENDPOINT='<FETCH FROM DATABASE>'" >&$output_fd
    echo "export AZURE_SEARCH_KEY='<FETCH FROM DATABASE>'" >&$output_fd
    echo "export AZURE_OPENAI_ENDPOINT='<FETCH FROM DATABASE>'" >&$output_fd
    echo "export AZURE_OPENAI_KEY='<FETCH FROM DATABASE>'" >&$output_fd
    echo "export AZURE_OPENAI_EMBEDDING_DEPLOYMENT='<FETCH FROM DATABASE>'" >&$output_fd
  elif [ -z "${DATABASE_URL:-}" ]; then
    echo "# ⚠️  DATABASE_URL not set - cannot fetch Azure config" >&$output_fd
    echo "export AZURE_STORAGE_CONNECTION_STRING='<SET MANUALLY>'" >&$output_fd
    echo "export AZURE_SEARCH_ENDPOINT='<SET MANUALLY>'" >&$output_fd
    echo "export AZURE_SEARCH_KEY='<SET MANUALLY>'" >&$output_fd
    echo "export AZURE_OPENAI_ENDPOINT='<SET MANUALLY>'" >&$output_fd
    echo "export AZURE_OPENAI_KEY='<SET MANUALLY>'" >&$output_fd
    echo "export AZURE_OPENAI_EMBEDDING_DEPLOYMENT='<SET MANUALLY>'" >&$output_fd
  else
    # Fetch from database
    # SECURITY: Use environment variables instead of command-line connection string
    # to prevent password exposure in process listings (ps aux)
    echo "# Fetching from database..." >&$output_fd
    
    # Run psql queries in a subshell with isolated environment variables
    # This prevents credentials from appearing in 'ps aux' output
    AZURE_STORAGE=$( (
      export PGHOST="${PGHOST:-}"
      export PGPORT="${PGPORT:-5432}"
      export PGUSER="${PGUSER:-}"
      export PGPASSWORD="${PGPASSWORD:-}"
      export PGDATABASE="${PGDATABASE:-}"
      psql -t -c "SELECT value FROM system_config WHERE key = 'AZURE_STORAGE_CONNECTION_STRING';" 2>/dev/null | xargs || echo ""
    ) )
    
    AZURE_SEARCH_ENDPOINT=$( (
      export PGHOST="${PGHOST:-}"
      export PGPORT="${PGPORT:-5432}"
      export PGUSER="${PGUSER:-}"
      export PGPASSWORD="${PGPASSWORD:-}"
      export PGDATABASE="${PGDATABASE:-}"
      psql -t -c "SELECT value FROM system_config WHERE key = 'AZURE_SEARCH_ENDPOINT';" 2>/dev/null | xargs || echo ""
    ) )
    
    AZURE_SEARCH_KEY=$( (
      export PGHOST="${PGHOST:-}"
      export PGPORT="${PGPORT:-5432}"
      export PGUSER="${PGUSER:-}"
      export PGPASSWORD="${PGPASSWORD:-}"
      export PGDATABASE="${PGDATABASE:-}"
      psql -t -c "SELECT value FROM system_config WHERE key = 'AZURE_SEARCH_KEY';" 2>/dev/null | xargs || echo ""
    ) )
    
    AZURE_OPENAI_ENDPOINT=$( (
      export PGHOST="${PGHOST:-}"
      export PGPORT="${PGPORT:-5432}"
      export PGUSER="${PGUSER:-}"
      export PGPASSWORD="${PGPASSWORD:-}"
      export PGDATABASE="${PGDATABASE:-}"
      psql -t -c "SELECT value FROM system_config WHERE key = 'AZURE_OPENAI_ENDPOINT';" 2>/dev/null | xargs || echo ""
    ) )
    
    AZURE_OPENAI_KEY=$( (
      export PGHOST="${PGHOST:-}"
      export PGPORT="${PGPORT:-5432}"
      export PGUSER="${PGUSER:-}"
      export PGPASSWORD="${PGPASSWORD:-}"
      export PGDATABASE="${PGDATABASE:-}"
      psql -t -c "SELECT value FROM system_config WHERE key = 'AZURE_OPENAI_KEY';" 2>/dev/null | xargs || echo ""
    ) )
    
    AZURE_OPENAI_DEPLOYMENT=$( (
      export PGHOST="${PGHOST:-}"
      export PGPORT="${PGPORT:-5432}"
      export PGUSER="${PGUSER:-}"
      export PGPASSWORD="${PGPASSWORD:-}"
      export PGDATABASE="${PGDATABASE:-}"
      psql -t -c "SELECT value FROM system_config WHERE key = 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT';" 2>/dev/null | xargs || echo ""
    ) )

    if [ -z "$AZURE_STORAGE" ]; then
      echo "# ⚠️  Azure credentials not found in database!" >&$output_fd
      echo "# Configure them in Admin Config page first" >&$output_fd
      echo "export AZURE_STORAGE_CONNECTION_STRING='<CONFIGURE IN ADMIN>'" >&$output_fd
      echo "export AZURE_SEARCH_ENDPOINT='<CONFIGURE IN ADMIN>'" >&$output_fd
      echo "export AZURE_SEARCH_KEY='<CONFIGURE IN ADMIN>'" >&$output_fd
      echo "export AZURE_OPENAI_ENDPOINT='<CONFIGURE IN ADMIN>'" >&$output_fd
      echo "export AZURE_OPENAI_KEY='<CONFIGURE IN ADMIN>'" >&$output_fd
      echo "export AZURE_OPENAI_EMBEDDING_DEPLOYMENT='<CONFIGURE IN ADMIN>'" >&$output_fd
    else
      echo "# ✓ Successfully fetched from database" >&$output_fd
      echo "export AZURE_STORAGE_CONNECTION_STRING='${AZURE_STORAGE}'" >&$output_fd
      echo "export AZURE_SEARCH_ENDPOINT='${AZURE_SEARCH_ENDPOINT}'" >&$output_fd
      echo "export AZURE_SEARCH_KEY='${AZURE_SEARCH_KEY}'" >&$output_fd
      echo "export AZURE_OPENAI_ENDPOINT='${AZURE_OPENAI_ENDPOINT}'" >&$output_fd
      echo "export AZURE_OPENAI_KEY='${AZURE_OPENAI_KEY}'" >&$output_fd
      echo "export AZURE_OPENAI_EMBEDDING_DEPLOYMENT='${AZURE_OPENAI_DEPLOYMENT}'" >&$output_fd
    fi
  fi

  echo "" >&$output_fd
  cat >&$output_fd << 'EOF'
# ======================================================
# SECURITY CHECKLIST FOR PRODUCTION
# ======================================================
# [ ] Generate new SESSION_SECRET: openssl rand -base64 32
# [ ] Replace AI_INTEGRATIONS_OPENAI_API_KEY with real OpenAI key
# [ ] Change AI_INTEGRATIONS_OPENAI_BASE_URL to https://api.openai.com/v1
# [ ] Update DATABASE_URL if migrating to Azure PostgreSQL
# [ ] Consider rotating all Azure keys for security
# [ ] Delete this file after use!
# ======================================================
EOF
}

# Main execution logic
if [ "$FORCE_STDOUT" = true ]; then
  # Force output to terminal (with warning)
  if [ -t 1 ]; then
    echo "⚠️  WARNING: This will output SENSITIVE CREDENTIALS to your terminal!" >&2
    echo "" >&2
    echo "This will expose secrets in:" >&2
    echo "  - Terminal scrollback" >&2
    echo "  - Shell history" >&2
    echo "  - Screen recordings" >&2
    echo "  - tmux/screen session logs" >&2
    echo "" >&2
    read -p "Continue anyway? (type 'YES' in capitals to proceed): " confirm >&2
    if [ "$confirm" != "YES" ]; then
      echo "Aborted. No secrets were displayed." >&2
      exit 1
    fi
    echo "" >&2
  fi
  generate_env_vars 1
elif [ -n "$OUTPUT_FILE" ]; then
  # Write to specified file (umask 077 already set)
  # Ensure parent directory exists
  mkdir -p "$(dirname "$OUTPUT_FILE")"
  # Create file with restrictive permissions
  touch "$OUTPUT_FILE"
  chmod 600 "$OUTPUT_FILE"
  # Generate and write
  generate_env_vars 1 > "$OUTPUT_FILE"
  echo "✓ Environment variables written to: $OUTPUT_FILE" >&2
  echo "  File permissions: $(ls -l "$OUTPUT_FILE" | awk '{print $1}')" >&2
  echo "" >&2
  echo "Next steps:" >&2
  echo "  1. Review the file: cat $OUTPUT_FILE" >&2
  echo "  2. Source it: source $OUTPUT_FILE" >&2
  echo "  3. Delete it: rm $OUTPUT_FILE" >&2
else
  # Auto-generate secure temp file
  TEMP_FILE=$(mktemp /tmp/intellibid-env.XXXXXX)
  chmod 600 "$TEMP_FILE"
  generate_env_vars 1 > "$TEMP_FILE"
  
  echo "✓ Environment variables written to secure temp file:" >&2
  echo "  $TEMP_FILE" >&2
  echo "  File permissions: $(ls -l "$TEMP_FILE" | awk '{print $1}')" >&2
  echo "" >&2
  echo "Next steps:" >&2
  echo "  1. Review the file: cat $TEMP_FILE" >&2
  echo "  2. Source it: source $TEMP_FILE" >&2
  echo "  3. Delete it: rm $TEMP_FILE" >&2
  echo "" >&2
  echo "⚠️  IMPORTANT: Delete the file after use to protect your credentials!" >&2
fi
