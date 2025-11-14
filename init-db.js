#!/usr/bin/env node
/**
 * Database Initialization Script for Azure PostgreSQL
 * 
 * This script can be run from within the Docker container to initialize
 * the database schema on first deployment.
 * 
 * Usage:
 *   node init-db.js
 * 
 * Or add to Dockerfile/startup process:
 *   CMD ["sh", "-c", "node init-db.js && npm start"]
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function initDatabase() {
  console.log('=================================');
  console.log('IntelliBid Database Initialization');
  console.log('=================================\n');

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    console.error('Cannot initialize database without connection string');
    process.exit(1);
  }

  console.log('✓ DATABASE_URL is configured');
  
  // Extract host for display (without credentials)
  const dbHost = process.env.DATABASE_URL.match(/@([^:/]+)/)?.[1] || 'unknown';
  console.log(`Target database: ${dbHost}\n`);

  try {
    console.log('Deploying database schema...');
    console.log('Running: drizzle-kit push\n');

    // Run db:push to sync schema
    const { stdout, stderr } = await execAsync('npx drizzle-kit push --force', {
      env: process.env
    });

    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    console.log('\n=================================');
    console.log('✓ Database initialization complete!');
    console.log('=================================\n');

  } catch (error) {
    console.error('\n=================================');
    console.error('✗ Database initialization failed!');
    console.error('=================================\n');
    console.error('Error:', error.message);
    
    if (error.stdout) console.error('Output:', error.stdout);
    if (error.stderr) console.error('Error output:', error.stderr);
    
    console.error('\nPlease check:');
    console.error('1. DATABASE_URL is correct');
    console.error('2. Database server is accessible');
    console.error('3. User has sufficient permissions');
    
    process.exit(1);
  }
}

// Run initialization
initDatabase();
