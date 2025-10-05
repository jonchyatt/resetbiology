# Fix WordPress Username

## Problem
Created user with username "admin" but wanted "ResetBiology"

## Solution: Create New Admin User

### Step 1: Login with Current User
- Go to: http://localhost:8080/wp-admin
- Username: `admin` (or whatever you used)
- Password: `ResetBiology2024!`

### Step 2: Create New Admin User
1. Go to **Users** → **Add New**
2. Fill in:
   - **Username:** `ResetBiology` (CANNOT change this later!)
   - **Email:** Use a different email (e.g., admin@resetbiology.com)
   - **First Name:** Reset
   - **Last Name:** Biology
   - **Website:** https://resetbiology.com
   - **Password:** `ResetBiology2024!`
   - **Role:** Administrator
3. Click **Add New User**

### Step 3: Login as New User
1. Log out
2. Login with:
   - Username: `ResetBiology`
   - Password: `ResetBiology2024!`

### Step 4: Delete Old Admin (Optional)
1. Go to **Users** → **All Users**
2. Hover over old "admin" user
3. Click **Delete**
4. On confirmation screen:
   - **Attribute all content to:** Select "ResetBiology"
   - Click **Confirm Deletion**

Done! Now you have the correct username.

## Alternative: Just Use It As-Is
Honestly, the username doesn't matter much since:
- Users never see it (they see your Display Name)
- Only you use it to login
- It's not shown anywhere on the storefront

You could just keep "admin" and change the **Display Name** to "Reset Biology":
1. **Users** → **Profile**
2. **Display name publicly as:** Change to "Reset Biology"
3. **Update Profile**

This way all posts/pages show "Reset Biology" as author.
