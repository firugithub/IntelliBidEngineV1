#!/bin/bash

# Shell script to push latest IntelliBid code to GitHub
# Usage: bash push-to-github.sh

echo "🚀 Pushing IntelliBid code to GitHub..."
echo ""

# Remove git lock file if it exists
if [ -f .git/index.lock ]; then
    echo "⚠️  Removing stale git lock file..."
    rm .git/index.lock
    echo "✅ Lock file removed"
    echo ""
fi

# Stage all changes
echo "📦 Staging all changes..."
git add .
if [ $? -ne 0 ]; then
    echo "❌ Failed to stage changes"
    exit 1
fi
echo "✅ Changes staged"
echo ""

# Commit with descriptive message
echo "💾 Committing changes..."
git commit -m "Fix: Production deployment path resolution for AI agent prompts

- Updated multiAgentEvaluator.ts to use process.cwd() instead of __dirname
- Fixed path resolution to work in both dev and production environments
- Application now runs correctly on Azure VM and bundled builds
- Fixed Portfolio RFT download to extract blob URLs from nested pack metadata
- Added backward compatibility for legacy and new pack structures
- Complete workflow: Draft → Pack → Publish → Portfolio Download verified"

if [ $? -ne 0 ]; then
    echo "⚠️  Nothing to commit or commit failed"
    # Check if it's because there are no changes
    if git diff-index --quiet HEAD --; then
        echo "ℹ️  No changes to commit - repository is up to date"
    else
        exit 1
    fi
fi
echo ""

# Push to GitHub
echo "⬆️  Pushing to GitHub (origin/main)..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo "🔗 Repository: https://github.com/firugithub/IntelliBidEngineV1.git"
else
    echo ""
    echo "❌ Push failed. You may need to:"
    echo "   1. Check your GitHub credentials"
    echo "   2. Use: git push https://<USERNAME>:<GITHUB_PAT>@github.com/firugithub/IntelliBidEngineV1.git main"
    echo "   3. Or set up SSH keys for GitHub"
    exit 1
fi
