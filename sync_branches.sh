#!/bin/bash

echo "🔄 Syncing main and development branches..."
echo ""

# Make sure we're on development and it's up to date
git checkout development
echo "✓ Switched to development branch"

# Switch to main branch
git checkout main
echo "✓ Switched to main branch"

# Pull latest main from remote (if any)
git pull origin main
echo "✓ Pulled latest from remote main"

# Merge development into main to get all changes
git merge development -m "Sync main with development - include all today's changes"
echo "✓ Merged development into main"

# Switch back to development
git checkout development
echo "✓ Switched back to development"

# Verify both branches are now identical
echo ""
echo "📊 Checking if branches are synced..."
DIFF=$(git diff main development --stat)
if [ -z "$DIFF" ]; then
    echo "✅ SUCCESS: Both branches are now identical!"
else
    echo "⚠️  There are still differences:"
    git diff main development --stat
fi

echo ""
echo "📝 Current status:"
echo "   - Current branch: $(git branch --show-current)"
echo "   - Ready to push: git push origin main && git push origin development"
echo ""
echo "🎯 Next steps:"
echo "   1. Review the changes above"
echo "   2. Run: git push origin main"
echo "   3. Run: git push origin development"
echo ""
