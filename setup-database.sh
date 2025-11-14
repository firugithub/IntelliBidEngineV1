#!/bin/bash
# Database Setup Script for Azure PostgreSQL
# This script initializes the database schema for IntelliBid production deployment

set -euo pipefail

echo "==================================="
echo "IntelliBid Database Setup Script"
echo "==================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set"
    echo ""
    echo "Please set DATABASE_URL to your Azure PostgreSQL connection string:"
    echo "export DATABASE_URL='postgresql://user:password@host:5432/database?sslmode=require'"
    exit 1
fi

echo "✓ DATABASE_URL is set"
echo ""

# Extract database host for display (without password)
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's/.*@([^:\/]+).*/\1/')
echo "Target database: $DB_HOST"
echo ""

# Test database connectivity
echo "Testing database connectivity..."
if ! npm run db:push -- --help > /dev/null 2>&1; then
    echo "ERROR: drizzle-kit is not installed"
    echo "Run: npm install"
    exit 1
fi

echo "✓ drizzle-kit is available"
echo ""

# Push schema to database
echo "Deploying database schema..."
echo ""
echo "This will:"
echo "  1. Create all tables if they don't exist"
echo "  2. Add any missing columns"
echo "  3. Update column types if needed"
echo ""

read -p "Continue with schema deployment? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted by user"
    exit 0
fi

echo ""
echo "Running database migration..."
npm run db:push

echo ""
echo "==================================="
echo "✓ Database setup complete!"
echo "==================================="
echo ""
echo "Your IntelliBid database is now ready for use."
