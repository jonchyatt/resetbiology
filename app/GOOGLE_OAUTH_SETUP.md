# Google OAuth Setup Instructions

This guide will walk you through setting up Google OAuth 2.0 credentials for Reset Biology authentication.

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Create Project" or select an existing project
3. Name your project (e.g., "Reset Biology")
4. Click "Create"

## Step 2: Enable Google APIs

1. In your Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for and enable these APIs:
   - **Google+ API** (for user profile information)
   - **Google Drive API** (for user data storage)

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type (unless you have Google Workspace)
3. Fill in the required fields:
   - **App name**: Reset Biology
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Add authorized domains: `localhost` (for development)
5. Skip scopes for now (we'll set them in credentials)
6. Add test users (your email addresses for testing)

## Step 4: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Name it "Reset Biology Web Client"
5. Add authorized JavaScript origins:
   - `http://localhost:3000`
   - `https://yourdomain.com` (for production)
6. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://yourdomain.com/api/auth/callback/google` (for production)
7. Click "Create"

## Step 5: Get Your Credentials

1. After creating, you'll see a popup with:
   - **Client ID**: Copy this
   - **Client Secret**: Copy this
2. Download the JSON file as backup

## Step 6: Update Environment Variables

Edit your `.env.local` file:

```bash
# Replace with your actual credentials
GOOGLE_CLIENT_ID=123456789-abcdefghijk.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijk123456789

# These should already be set
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-key-generate-new-one
DATABASE_URL="postgresql://resetbiology:password@localhost:5432/resetbiology?schema=public"
```

## Step 7: Generate NextAuth Secret

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

Copy the output and use it for `NEXTAUTH_SECRET`.

## Step 8: Set Up Database (if needed)

If you don't have PostgreSQL set up:

1. Install PostgreSQL
2. Create database and user:
```sql
CREATE DATABASE resetbiology;
CREATE USER resetbiology WITH ENCRYPTED PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE resetbiology TO resetbiology;
```

3. Run Prisma migrations:
```bash
npx prisma db push
```

## Step 9: Test the Setup

1. Start your development server:
```bash
npm run dev
```

2. Navigate to: `http://localhost:3000/auth/signin`
3. Click "Sign in with Google"
4. Complete OAuth flow
5. Check that you're redirected to the portal

## Troubleshooting

### Common Issues:

**"redirect_uri_mismatch" error:**
- Ensure your redirect URI exactly matches what's in Google Console
- Check for trailing slashes

**"Client ID not found" error:**
- Verify your Client ID is correctly copied
- Check there are no extra spaces in .env.local

**Database connection error:**
- Verify PostgreSQL is running
- Check your DATABASE_URL format
- Ensure database and user exist

**NextAuth secret error:**
- Generate a new NEXTAUTH_SECRET
- Ensure it's properly set in .env.local

### Testing OAuth Flow:

1. Open browser DevTools > Network tab
2. Try signing in
3. Look for successful API calls to `/api/auth/*`
4. Check if user is created in database:
```sql
SELECT * FROM users;
```

## Production Deployment

For production:

1. Update authorized origins and redirect URIs in Google Console
2. Use secure, random secrets
3. Use proper PostgreSQL connection string
4. Enable HTTPS
5. Consider using Google Workspace for internal user management

## Security Notes

- Never commit `.env.local` to version control
- Rotate secrets regularly
- Use least privilege principle for API scopes
- Monitor OAuth usage in Google Console
- Set up proper error monitoring

Your Google OAuth integration should now be ready for Reset Biology authentication!