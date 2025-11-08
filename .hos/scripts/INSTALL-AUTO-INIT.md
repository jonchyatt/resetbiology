# HOS Auto-Init Installation Guide

This guide shows you how to automatically display HOS status when you open a terminal in your Reset Biology project.

---

## 🪟 Windows PowerShell Setup

### Option 1: Automatic Installation (Recommended)

Run this command in PowerShell (as Administrator if needed):

```powershell
# Navigate to project directory
cd C:\Users\jonch\reset-biology-website

# Check if profile exists
if (!(Test-Path $PROFILE)) {
    New-Item -Path $PROFILE -ItemType File -Force
}

# Add HOS init to profile
Add-Content -Path $PROFILE -Value "`n# HOS Auto-Init for Reset Biology"
Add-Content -Path $PROFILE -Value ". 'C:\Users\jonch\reset-biology-website\.hos\scripts\hos-init.ps1'"

# Reload profile
. $PROFILE
```

### Option 2: Manual Installation

1. **Open PowerShell profile:**
   ```powershell
   notepad $PROFILE
   ```

   If the file doesn't exist, create it:
   ```powershell
   New-Item -Path $PROFILE -ItemType File -Force
   notepad $PROFILE
   ```

2. **Add this line to the end of the file:**
   ```powershell
   # HOS Auto-Init for Reset Biology
   . 'C:\Users\jonch\reset-biology-website\.hos\scripts\hos-init.ps1'
   ```

3. **Save and close Notepad**

4. **Reload your profile:**
   ```powershell
   . $PROFILE
   ```

5. **Test it:**
   ```powershell
   cd C:\Users\jonch\reset-biology-website
   # You should see HOS status display automatically
   ```

---

## 🐧 Git Bash / WSL / Linux Setup

### Option 1: Automatic Installation (Recommended)

Run these commands in your Bash terminal:

```bash
# Navigate to project directory
cd ~/reset-biology-website

# Detect shell config file
if [ -f ~/.zshrc ]; then
    SHELL_CONFIG=~/.zshrc
elif [ -f ~/.bashrc ]; then
    SHELL_CONFIG=~/.bashrc
else
    SHELL_CONFIG=~/.bash_profile
fi

# Add HOS init to shell config
echo "" >> $SHELL_CONFIG
echo "# HOS Auto-Init for Reset Biology" >> $SHELL_CONFIG
echo "if [ -f ~/reset-biology-website/.hos/scripts/hos-init.sh ]; then" >> $SHELL_CONFIG
echo "    source ~/reset-biology-website/.hos/scripts/hos-init.sh" >> $SHELL_CONFIG
echo "fi" >> $SHELL_CONFIG

# Reload shell config
source $SHELL_CONFIG
```

### Option 2: Manual Installation

1. **Determine your shell:**
   ```bash
   echo $SHELL
   ```

2. **Edit the appropriate config file:**
   - If using **Zsh**: `nano ~/.zshrc`
   - If using **Bash**: `nano ~/.bashrc`
   - If on **macOS with Bash**: `nano ~/.bash_profile`

3. **Add these lines to the end:**
   ```bash
   # HOS Auto-Init for Reset Biology
   if [ -f ~/reset-biology-website/.hos/scripts/hos-init.sh ]; then
       source ~/reset-biology-website/.hos/scripts/hos-init.sh
   fi
   ```

4. **Save and exit** (Ctrl+O, Enter, Ctrl+X in nano)

5. **Reload your shell:**
   ```bash
   source ~/.bashrc  # or ~/.zshrc or ~/.bash_profile
   ```

6. **Test it:**
   ```bash
   cd ~/reset-biology-website
   # You should see HOS status display automatically
   ```

---

## 🎯 What Happens After Installation

### On Terminal Open (in project directory)

You'll see:

```
═══════════════════════════════════════════════════════
  HOS (Hierarchical Orchestration System) ACTIVE
═══════════════════════════════════════════════════════

📍 Project: Reset Biology Website
🎯 Mission: Cellular health optimization platform

🤖 Agents Active: 5
📚 Skills Available: 27

💚 System Health: Monitoring Active
   Status: ✅ Operational

───────────────────────────────────────────────────────
Quick Commands:
  • 'Use playwright-vision to test [page]'
  • 'Check system health'
  • 'Create a new skill for [task]'
  • 'Validate [component] design'

📖 Manual: .hos/manual/HOS-MANUAL.md
📊 Dashboard: .hos/dashboard/health.md
✅ Verification: .hos/VERIFICATION-COMPLETE.md

═══════════════════════════════════════════════════════
```

### Available Commands

After installation, these commands are available in your terminal:

#### PowerShell:
```powershell
Show-HOSStatus          # Display HOS system status
Get-HOSPriorities       # Show today's priorities
Invoke-HOSHealthCheck   # Run health check on all components
```

#### Bash/Zsh:
```bash
hos-status              # Display HOS system status
hos-priorities          # Show today's priorities
hos-health              # Run health check on all components
```

---

## 🔧 Customization

### Disable Auto-Display on Startup

If you want the functions available but don't want auto-display:

**PowerShell (`hos-init.ps1`):**
Comment out the last section:
```powershell
# Auto-run on terminal open if in HOS-enabled project
# if (Test-Path ".hos") {
#     Show-HOSStatus
# }
```

**Bash (`hos-init.sh`):**
Comment out the last section:
```bash
# Auto-run on terminal open if in HOS-enabled project
# if [ -d ".hos" ]; then
#     show_hos_status
# fi
```

### Show Priorities on Startup

Uncomment this line in either script:

**PowerShell:**
```powershell
Get-HOSPriorities  # Uncomment to show priorities on startup
```

**Bash:**
```bash
get_hos_priorities  # Uncomment to show priorities on startup
```

---

## ❌ Uninstallation

### PowerShell

1. Open profile:
   ```powershell
   notepad $PROFILE
   ```

2. Remove these lines:
   ```powershell
   # HOS Auto-Init for Reset Biology
   . 'C:\Users\jonch\reset-biology-website\.hos\scripts\hos-init.ps1'
   ```

3. Save and reload:
   ```powershell
   . $PROFILE
   ```

### Bash/Zsh

1. Edit config file:
   ```bash
   nano ~/.bashrc  # or ~/.zshrc
   ```

2. Remove these lines:
   ```bash
   # HOS Auto-Init for Reset Biology
   if [ -f ~/reset-biology-website/.hos/scripts/hos-init.sh ]; then
       source ~/reset-biology-website/.hos/scripts/hos-init.sh
   fi
   ```

3. Save and reload:
   ```bash
   source ~/.bashrc  # or ~/.zshrc
   ```

---

## 🐛 Troubleshooting

### "Cannot find path" error (PowerShell)

Make sure the path is correct. If your project is elsewhere:
```powershell
# Update the path in $PROFILE to match your actual location
. 'C:\Your\Actual\Path\reset-biology-website\.hos\scripts\hos-init.ps1'
```

### "Permission denied" error (Bash)

Make the script executable:
```bash
chmod +x ~/reset-biology-website/.hos/scripts/hos-init.sh
```

### Script doesn't run automatically

Make sure you're in the project directory:
```bash
cd ~/reset-biology-website  # or C:\Users\jonch\reset-biology-website
```

The script only activates when `.hos` directory is present in current directory.

### Colors not displaying (Bash)

Make sure your terminal supports ANSI colors. Most modern terminals do by default.

---

## 📚 Additional Resources

- **HOS Manual:** `.hos/manual/HOS-MANUAL.md`
- **System Verification:** `.hos/VERIFICATION-COMPLETE.md`
- **Health Dashboard:** `.hos/dashboard/health.md`
- **Skills Directory:** `.hos/skills/`

---

## ✅ Verification

After installation, verify it works:

1. **Close and reopen your terminal**
2. **Navigate to project:**
   ```
   cd C:\Users\jonch\reset-biology-website
   # or
   cd ~/reset-biology-website
   ```
3. **You should see HOS status automatically**
4. **Test manual commands:**
   ```
   hos-health  # or Invoke-HOSHealthCheck in PowerShell
   ```

If you see the HOS banner and status, installation is successful! 🎉

---

**Last Updated:** 2025-11-04
**Compatible With:** Windows PowerShell, Git Bash, Bash, Zsh, WSL
