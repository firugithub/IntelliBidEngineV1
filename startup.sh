#!/bin/sh
# Startup script for Azure App Service to configure DNS for private endpoints
# This script runs as root to configure DNS, then drops privileges to run the app

set -euo pipefail

echo "Configuring Azure DNS for private endpoint resolution..."

# Set Azure DNS server (168.63.129.16) for private endpoint resolution
# This is required for Docker containers on Azure App Service to resolve Private DNS zones
if echo "nameserver 168.63.129.16" > /etc/resolv.conf; then
    echo "DNS configured successfully (nameserver 168.63.129.16)"
else
    echo "ERROR: Failed to configure DNS resolver" >&2
    exit 1
fi

echo "Starting application as nodejs user..."

# Drop privileges and start the Node.js application as nodejs user
# Using su-exec for clean privilege dropping (more secure than su -c)
exec su-exec nodejs npm start
