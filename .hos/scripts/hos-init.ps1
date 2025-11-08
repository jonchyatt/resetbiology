# HOS Auto-Init Script for PowerShell
# Automatically displays system status when terminal opens in HOS-enabled project
# Add to PowerShell profile: $PROFILE

function Show-HOSStatus {
    $hosPath = ".hos"

    # Check if current directory or parent has .hos
    if (Test-Path $hosPath) {
        Write-Host ""
        Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
        Write-Host "  HOS (Hierarchical Orchestration System) ACTIVE" -ForegroundColor Green
        Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
        Write-Host ""

        # Display project info
        if (Test-Path "$hosPath/orchestra/discovered-vision.md") {
            Write-Host "📍 Project: Reset Biology Website" -ForegroundColor Yellow
            Write-Host "🎯 Mission: Cellular health optimization platform" -ForegroundColor Yellow
        }

        Write-Host ""

        # Display agent count
        if (Test-Path "$hosPath/agents") {
            $agentCount = (Get-ChildItem "$hosPath/agents" -Directory).Count
            Write-Host "🤖 Agents Active: $agentCount" -ForegroundColor Magenta
        }

        # Display skill count
        if (Test-Path "$hosPath/skills") {
            $skillCount = (Get-ChildItem "$hosPath/skills" -Recurse -Filter "skill.md").Count
            Write-Host "📚 Skills Available: $skillCount" -ForegroundColor Magenta
        }

        Write-Host ""

        # Display health status
        if (Test-Path "$hosPath/dashboard/health.md") {
            Write-Host "💚 System Health: Monitoring Active" -ForegroundColor Green

            # Parse health.md for key metrics (optional)
            $healthContent = Get-Content "$hosPath/dashboard/health.md" -Raw
            if ($healthContent -match "Status:\s*(\w+)") {
                $status = $matches[1]
                if ($status -eq "Healthy" -or $status -eq "Operational") {
                    Write-Host "   Status: ✅ $status" -ForegroundColor Green
                } else {
                    Write-Host "   Status: ⚠️ $status" -ForegroundColor Yellow
                }
            }
        }

        Write-Host ""
        Write-Host "───────────────────────────────────────────────────────" -ForegroundColor DarkGray
        Write-Host "Quick Commands:" -ForegroundColor White
        Write-Host "  • 'Use playwright-vision to test [page]'" -ForegroundColor DarkGray
        Write-Host "  • 'Check system health'" -ForegroundColor DarkGray
        Write-Host "  • 'Create a new skill for [task]'" -ForegroundColor DarkGray
        Write-Host "  • 'Validate [component] design'" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "📖 Manual: .hos/manual/HOS-MANUAL.md" -ForegroundColor DarkCyan
        Write-Host "📊 Dashboard: .hos/dashboard/health.md" -ForegroundColor DarkCyan
        Write-Host "✅ Verification: .hos/VERIFICATION-COMPLETE.md" -ForegroundColor DarkCyan
        Write-Host ""
        Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
        Write-Host ""
    }
}

function Get-HOSPriorities {
    $prioritiesPath = ".hos/reports/priority-fixes.md"

    if (Test-Path $prioritiesPath) {
        Write-Host "📋 Today's Priorities:" -ForegroundColor Yellow
        Write-Host ""

        # Extract top 3 priorities from priority-fixes.md
        $content = Get-Content $prioritiesPath
        $priorities = $content | Select-String "^- \[.\]" | Select-Object -First 3

        foreach ($priority in $priorities) {
            Write-Host "   $priority" -ForegroundColor White
        }

        Write-Host ""
    }
}

function Invoke-HOSHealthCheck {
    Write-Host "🏥 Running HOS Health Check..." -ForegroundColor Cyan
    Write-Host ""

    # Check critical components
    $checks = @(
        @{ Name = "Agents Directory"; Path = ".hos/agents"; Icon = "🤖" }
        @{ Name = "Skills Directory"; Path = ".hos/skills"; Icon = "📚" }
        @{ Name = "Manual"; Path = ".hos/manual/HOS-MANUAL.md"; Icon = "📖" }
        @{ Name = "Dashboard"; Path = ".hos/dashboard/health.md"; Icon = "📊" }
        @{ Name = "Playwright Config"; Path = "playwright.config.ts"; Icon = "🎭" }
        @{ Name = "Node Modules"; Path = "node_modules/playwright"; Icon = "📦" }
    )

    foreach ($check in $checks) {
        if (Test-Path $check.Path) {
            Write-Host "  ✅ $($check.Icon) $($check.Name)" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $($check.Icon) $($check.Name) - Missing!" -ForegroundColor Red
        }
    }

    Write-Host ""
}

# Export functions for manual use
Export-ModuleMember -Function Show-HOSStatus, Get-HOSPriorities, Invoke-HOSHealthCheck

# Auto-run on terminal open if in HOS-enabled project
if (Test-Path ".hos") {
    Show-HOSStatus
    # Get-HOSPriorities  # Uncomment to show priorities on startup
}
