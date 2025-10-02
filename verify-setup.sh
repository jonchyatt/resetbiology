#!/bin/bash

# Reset Biology Development Environment Verification Script
# This script verifies all critical components for Claude Code development

echo "🔍 Reset Biology Environment Verification"
echo "=========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check and report status
check_component() {
    local component="$1"
    local command="$2"
    local expected="$3"
    
    echo -n "Checking $component... "
    
    if eval "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        if [ ! -z "$expected" ]; then
            echo -e "  ${YELLOW}Expected: $expected${NC}"
        fi
        return 1
    fi
}

# Track overall status
TOTAL_CHECKS=0
PASSED_CHECKS=0

# 1. WSL2 Environment
echo -e "${BLUE}1. WSL2 Environment${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if check_component "WSL2" "grep -qi microsoft /proc/version"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi
echo ""

# 2. Docker
echo -e "${BLUE}2. Docker Integration${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 2))
if check_component "Docker installation" "docker --version"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi
if check_component "Docker running" "docker ps"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi
echo ""

# 3. Claude Code
echo -e "${BLUE}3. Claude Code${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if check_component "Claude Code CLI" "claude --version"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi
echo ""

# 4. Node.js and npm
echo -e "${BLUE}4. Node.js Environment${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 2))
if check_component "Node.js" "node --version"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi
if check_component "npm" "npm --version"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi
echo ""

# 5. Playwright
echo -e "${BLUE}5. Playwright Testing${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 2))
if check_component "Playwright installation" "npx playwright --version"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi
if check_component "Chromium browser" "npx playwright list-files | grep -q chromium || ls ~/.cache/ms-playwright/chromium-* >/dev/null 2>&1"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi
echo ""

# 6. MCP (Model Context Protocol)
echo -e "${BLUE}6. Playwright MCP Integration${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if check_component "Playwright MCP" "claude mcp list | grep -q playwright"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi
echo ""

# 7. GitHub CLI
echo -e "${BLUE}7. GitHub Integration${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if check_component "GitHub CLI" "gh --version"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi
echo ""

# 8. Project Dependencies
echo -e "${BLUE}8. Project Dependencies${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 2))
if check_component "Project package.json" "test -f package.json"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi
if check_component "Node modules installed" "test -d node_modules"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi
echo ""

# 9. MongoDB Atlas Connection
echo -e "${BLUE}9. MongoDB Atlas Database${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 2))
if check_component "DATABASE_URL configured" "test ! -z \"$DATABASE_URL\" || grep -q 'DATABASE_URL.*mongodb+srv' .env.local"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi
if check_component "MongoDB Atlas connection" "DATABASE_URL=\"mongodb+srv://resetbiology-app:_DN8QDEm.XK.J8P@cluster0.weld7bm.mongodb.net/resetbiology?retryWrites=true&w=majority&appName=Cluster0\" npx prisma db push --accept-data-loss --force-reset 2>/dev/null || DATABASE_URL=\"mongodb+srv://resetbiology-app:_DN8QDEm.XK.J8P@cluster0.weld7bm.mongodb.net/resetbiology?retryWrites=true&w=majority&appName=Cluster0\" node -e \"const {PrismaClient} = require('@prisma/client'); const prisma = new PrismaClient({datasources:{db:{url:process.env.DATABASE_URL}}}); prisma.user.count().then(()=>process.exit(0)).catch(()=>process.exit(1));\""; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi
echo ""

# Final Report
echo "=========================================="
echo -e "${BLUE}VERIFICATION SUMMARY${NC}"
echo "=========================================="

if [ $PASSED_CHECKS -eq $TOTAL_CHECKS ]; then
    echo -e "${GREEN}🎉 ALL SYSTEMS OPERATIONAL${NC} ($PASSED_CHECKS/$TOTAL_CHECKS)"
    echo -e "${GREEN}🚀 Ready for Reset Biology development${NC}"
    echo ""
    echo -e "${YELLOW}Quick Start Commands:${NC}"
    echo "  npm run dev              # Start development server"
    echo "  npx playwright test      # Run tests"
    echo "  claude mcp list          # Check MCP status"
    echo "  npx prisma studio        # View MongoDB Atlas data"
else
    echo -e "${RED}⚠️  ISSUES DETECTED${NC} ($PASSED_CHECKS/$TOTAL_CHECKS passed)"
    echo -e "${YELLOW}Please resolve the failed checks above${NC}"
fi

echo ""
echo "Last verified: $(date)"