import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function fixUserAuth() {
  try {
    console.log('🔍 Finding user by email...')

    // First, find the user by email
    let user = await prisma.user.findUnique({
      where: { email: 'jonchyatt@gmail.com' }
    })

    if (user) {
      console.log(`✅ Found user: ${user.name}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Auth0 ID: ${user.auth0Sub || 'NOT SET'}`)
      console.log(`   Role: ${user.role}`)
      console.log(`   Access Level: ${user.accessLevel}`)

      // Update to admin if needed
      if (user.role !== 'admin' || user.accessLevel !== 'admin') {
        console.log('\n🔧 Upgrading to admin...')
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            role: 'admin',
            accessLevel: 'admin'
          }
        })
        console.log('✅ Admin access granted!')
      }

      // If no Auth0 ID, we need to set it
      if (!user.auth0Sub) {
        console.log('\n⚠️ No Auth0 ID set. User needs to be linked.')
        console.log('   When you log in, check the browser console or network tab')
        console.log('   for your Auth0 sub ID and update this user.')
      }

    } else {
      console.log('❌ No user found with email jonchyatt@gmail.com')
      console.log('\n📝 Creating new user...')

      user = await prisma.user.create({
        data: {
          email: 'jonchyatt@gmail.com',
          name: 'Jon Hyatt',
          role: 'admin',
          accessLevel: 'admin',
          emailVerified: new Date(),
          // Leave auth0Sub empty - will be set on first login
        }
      })

      console.log('✅ User created!')
      console.log(`   ID: ${user.id}`)
      console.log('   ⚠️ Auth0 ID will be set on first login')
    }

    // List all users to debug
    console.log('\n📊 All users in database:')
    const allUsers = await prisma.user.findMany({
      select: {
        email: true,
        auth0Sub: true,
        role: true,
        createdAt: true
      }
    })

    allUsers.forEach((u, i) => {
      console.log(`${i + 1}. ${u.email || 'NO EMAIL'}`)
      console.log(`   Auth0: ${u.auth0Sub || 'NOT SET'}`)
      console.log(`   Role: ${u.role}`)
      console.log(`   Created: ${u.createdAt}`)
      console.log('')
    })

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixUserAuth()