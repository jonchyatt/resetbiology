#!/bin/bash
# HOS Auto-Init Script for Bash/Zsh
# Automatically displays system status when terminal opens in HOS-enabled project
# Add to .bashrc or .zshrc:
# source ~/reset-biology-website/.hos/scripts/hos-init.sh

# Color codes
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
DGRAY='\033[0;90m'
RED='\033[0;31m'
NC='\033[0m' # No Color

show_hos_status() {
    local hos_path=".hos"

    # Check if current directory or parent has .hos
    if [ -d "$hos_path" ]; then
        echo ""
        echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}  HOS (Hierarchical Orchestration System) ACTIVE${NC}"
        echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"
        echo ""

        # Display project info
        if [ -f "$hos_path/orchestra/discovered-vision.md" ]; then
            echo -e "${YELLOW}📍 Project: Reset Biology Website${NC}"
            echo -e "${YELLOW}🎯 Mission: Cellular health optimization platform${NC}"
        fi

        echo ""

        # Display agent count
        if [ -d "$hos_path/agents" ]; then
            agent_count=$(find "$hos_path/agents" -mindepth 1 -maxdepth 1 -type d | wc -l)
            echo -e "${MAGENTA}🤖 Agents Active: ${agent_count}${NC}"
        fi

        # Display skill count
        if [ -d "$hos_path/skills" ]; then
            skill_count=$(find "$hos_path/skills" -name "skill.md" | wc -l)
            echo -e "${MAGENTA}📚 Skills Available: ${skill_count}${NC}"
        fi

        echo ""

        # Display health status
        if [ -f "$hos_path/dashboard/health.md" ]; then
            echo -e "${GREEN}💚 System Health: Monitoring Active${NC}"

            # Parse health.md for key metrics (optional)
            status=$(grep -m 1 "Status:" "$hos_path/dashboard/health.md" | sed 's/.*Status: *//')
            if [ ! -z "$status" ]; then
                if [[ "$status" =~ (Healthy|Operational) ]]; then
                    echo -e "   Status: ${GREEN}✅ $status${NC}"
                else
                    echo -e "   Status: ${YELLOW}⚠️ $status${NC}"
                fi
            fi
        fi

        echo ""
        echo -e "${DGRAY}───────────────────────────────────────────────────────${NC}"
        echo -e "${WHITE}Quick Commands:${NC}"
        echo -e "${DGRAY}  • 'Use playwright-vision to test [page]'${NC}"
        echo -e "${DGRAY}  • 'Check system health'${NC}"
        echo -e "${DGRAY}  • 'Create a new skill for [task]'${NC}"
        echo -e "${DGRAY}  • 'Validate [component] design'${NC}"
        echo ""
        echo -e "${CYAN}📖 Manual: .hos/manual/HOS-MANUAL.md${NC}"
        echo -e "${CYAN}📊 Dashboard: .hos/dashboard/health.md${NC}"
        echo -e "${CYAN}✅ Verification: .hos/VERIFICATION-COMPLETE.md${NC}"
        echo ""
        echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"
        echo ""
    fi
}

get_hos_priorities() {
    local priorities_path=".hos/reports/priority-fixes.md"

    if [ -f "$priorities_path" ]; then
        echo -e "${YELLOW}📋 Today's Priorities:${NC}"
        echo ""

        # Extract top 3 priorities from priority-fixes.md
        grep "^- \[.\]" "$priorities_path" | head -n 3 | while read line; do
            echo -e "   ${WHITE}$line${NC}"
        done

        echo ""
    fi
}

hos_health_check() {
    echo -e "${CYAN}🏥 Running HOS Health Check...${NC}"
    echo ""

    # Check critical components
    declare -A checks=(
        ["🤖 Agents Directory"]=".hos/agents"
        ["📚 Skills Directory"]=".hos/skills"
        ["📖 Manual"]=".hos/manual/HOS-MANUAL.md"
        ["📊 Dashboard"]=".hos/dashboard/health.md"
        ["🎭 Playwright Config"]="playwright.config.ts"
        ["📦 Node Modules"]="node_modules/playwright"
    )

    for name in "${!checks[@]}"; do
        path="${checks[$name]}"
        if [ -e "$path" ]; then
            echo -e "  ${GREEN}✅ $name${NC}"
        else
            echo -e "  ${RED}❌ $name - Missing!${NC}"
        fi
    done

    echo ""
}

# Export functions (make them available in shell)
export -f show_hos_status
export -f get_hos_priorities
export -f hos_health_check

# Create aliases for convenience
alias hos-status='show_hos_status'
alias hos-priorities='get_hos_priorities'
alias hos-health='hos_health_check'

# Auto-run on terminal open if in HOS-enabled project
if [ -d ".hos" ]; then
    show_hos_status
    # get_hos_priorities  # Uncomment to show priorities on startup
fi
