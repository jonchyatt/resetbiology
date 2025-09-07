# Live Google OAuth Setup - Reset Biology

## Step 1: Google Cloud Console Setup

1. **Open Google Cloud Console**: https://console.cloud.google.com/
2. **Create New Project**:
   - Click "Select a project" dropdown at the top
   - Click "NEW PROJECT"
   - Project name: `Reset Biology Auth`
   - Click "CREATE"
   - Wait for project to be created, then select it

## Step 2: Enable Required APIs

1. **Go to APIs & Services**:
   - In the left sidebar, click "APIs & Services" > "Library"
   
2. **Enable Google+ API**:
   - Search for "Google+ API"
   - Click on it and click "ENABLE"
   
3. **Enable Google Drive API**:
   - Search for "Google Drive API"  
   - Click on it and click "ENABLE"

## Step 3: Configure OAuth Consent Screen

1. **Go to OAuth Consent Screen**:
   - Left sidebar: "APIs & Services" > "OAuth consent screen"
   
2. **Choose User Type**:
   - Select "External" (unless you have Google Workspace)
   - Click "CREATE"

3. **Fill OAuth Consent Screen**:
   - App name: `Reset Biology`
   - User support email: `your-email@example.com`
   - App domain (optional): `localhost` for now
   - Developer contact information: `your-email@example.com`
   - Click "SAVE AND CONTINUE"

4. **Scopes** (Step 2):
   - Click "SAVE AND CONTINUE" (we'll use default scopes for now)

5. **Test Users** (Step 3):
   - Click "ADD USERS"
   - Add your Google email address
   - Click "SAVE AND CONTINUE"

6. **Summary**:
   - Review and click "BACK TO DASHBOARD"

## Step 4: Create OAuth 2.0 Credentials

1. **Go to Credentials**:
   - Left sidebar: "APIs & Services" > "Credentials"
   
2. **Create OAuth Client ID**:
   - Click "CREATE CREDENTIALS" > "OAuth 2.0 Client IDs"
   - Application type: "Web application"
   - Name: `Reset Biology Web Client`

3. **Configure URLs**:
   - **Authorized JavaScript origins**:
     - Click "ADD URI"
     - Enter: `http://localhost:3000`
   
   - **Authorized redirect URIs**:
     - Click "ADD URI" 
     - Enter: `http://localhost:3000/api/auth/callback/google`

4. **Create**:
   - Click "CREATE"
   - **SAVE THE POPUP INFO** - You'll need the Client ID and Client Secret!

## Step 5: Copy Your Credentials

From the popup, copy:
- **Client ID**: `123456789-abcdefghijklmnop.googleusercontent.com`
- **Client Secret**: `GOCSPX-AbCdEfGhIjKlMnOpQrStUv`

## Step 6: Update Environment Variables

I'll help you update your .env.local file with these credentials.