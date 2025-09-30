#!/bin/bash

# Kill all development processes to prevent resource drain
echo "🧹 Cleaning up development processes..."

# Kill Next.js dev servers
pkill -f "next dev" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null

# Kill any lingering Node processes in the project
pkill -f "reset-biology-website" 2>/dev/null

# Kill Playwright test processes
pkill -f "playwright" 2>/dev/null

# Show remaining Node processes
echo "Remaining Node processes:"
ps aux | grep -E "(node|npm|next)" | grep -v grep || echo "  None found ✅"

echo "✅ Cleanup complete"