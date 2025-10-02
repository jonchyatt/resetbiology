#!/usr/bin/env node

/**
 * Script to grant admin access to a user in MongoDB
 * Usage: npx tsx scripts/grant-admin.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function grantAdmin() {
  const email = 'jonchyatt@gmail.com';
  
  try {
    console.log(`\n🔍 Looking for user with email: ${email}`);
    
    // First, check if user exists
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
    
    if (!user) {
      console.log('❌ User not found in database');
      console.log('📝 Creating new user with admin privileges...');
      
      // Create user if doesn't exist
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name: 'Jon Chyatt',
          role: 'admin',
          accessLevel: 'admin',
          auth0Id: 'email|68c2e5dd9f6c3a843c910ba4', // From your session data
        }
      });
      
      console.log('✅ User created with admin privileges!');
    } else {
      console.log('✅ User found!');
      console.log('Current role:', user.role || 'not set');
      console.log('Current accessLevel:', user.accessLevel || 'not set');
      
      if (user.role === 'admin' || user.accessLevel === 'admin') {
        console.log('✅ User already has admin privileges!');
      } else {
        console.log('🔧 Updating user to have admin privileges...');
        
        user = await prisma.user.update({
          where: { email: email.toLowerCase() },
          data: {
            role: 'admin',
            accessLevel: 'admin'
          }
        });
        
        console.log('✅ User updated with admin privileges!');
      }
    }
    
    console.log('\n📋 Final user data:');
    console.log({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      accessLevel: user.accessLevel,
      auth0Id: user.auth0Id
    });
    
    console.log('\n🎉 Success! You should now be able to access /admin/store');
    console.log('⚠️  IMPORTANT: Clear your browser cookies and login again for changes to take effect!');
    console.log('\nNext steps:');
    console.log('1. Go to your browser and clear all cookies for resetbiology.com');
    console.log('2. Visit https://resetbiology.com/auth/debug');
    console.log('3. Click Login to authenticate again');
    console.log('4. Then visit https://resetbiology.com/admin/store');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
grantAdmin();