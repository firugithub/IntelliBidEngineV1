#!/bin/bash

# ====================================================
# IntelliBid Database Truncate Script
# ====================================================
# Safely truncates all tables in the database
# Usage: bash truncate-database.sh
# ====================================================

echo "⚠️  IntelliBid Database Truncate Utility"
echo "========================================"
echo ""
echo "WARNING: This will DELETE ALL DATA from your database!"
echo "The database schema (tables, structure) will remain intact."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo ""
    echo "Please set your database connection string:"
    echo "  export DATABASE_URL='postgresql://user:password@host:5432/database'"
    echo ""
    exit 1
fi

# Ask for confirmation
read -p "Are you sure you want to truncate ALL tables? (type 'yes' to confirm): " confirmation

if [ "$confirmation" != "yes" ]; then
    echo ""
    echo "❌ Truncation cancelled"
    echo "No changes were made to the database"
    exit 0
fi

echo ""
echo "🗑️  Truncating all tables..."
echo ""

# Execute the truncate SQL script
psql "$DATABASE_URL" -f azure-database-truncate.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database truncated successfully!"
    echo ""
    echo "📋 What was deleted:"
    echo "  • All portfolio data"
    echo "  • All projects and RFTs"
    echo "  • All vendor proposals and evaluations"
    echo "  • All RAG documents and chat sessions"
    echo "  • System configuration entries"
    echo ""
    echo "🔄 Optional next steps:"
    echo "  1. Re-seed with default data:"
    echo "     psql \"\$DATABASE_URL\" -f azure-database-seed.sql"
    echo ""
    echo "  2. Or start fresh with empty database (current state)"
    echo ""
else
    echo ""
    echo "❌ Truncation failed"
    echo "Please check the error messages above"
    exit 1
fi
