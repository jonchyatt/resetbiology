import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function createUser() {
  try {
    console.log('🔍 Checking for existing user...')

    // Common Auth0 ID formats
    const auth0Ids = [
      'google-oauth2|117420300508488218630', // Your likely Google OAuth ID
      'auth0|jonchyatt@gmail.com',
      'google-oauth2|jonchyatt@gmail.com'
    ]

    // Check if user exists
    for (const auth0Sub of auth0Ids) {
      const existingUser = await prisma.user.findUnique({
        where: { auth0Sub }
      })

      if (existingUser) {
        console.log(`✅ User already exists with ID: ${existingUser.id}`)
        console.log(`   Email: ${existingUser.email}`)
        console.log(`   Role: ${existingUser.role}`)
        console.log(`   Access Level: ${existingUser.accessLevel}`)

        if (existingUser.role !== 'admin' || existingUser.accessLevel !== 'admin') {
          console.log('🔧 Granting admin access...')
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              role: 'admin',
              accessLevel: 'admin'
            }
          })
          console.log('✅ Admin access granted!')
        }
        return
      }
    }

    // Create new user with the most likely Auth0 ID
    console.log('📝 Creating new user...')
    const newUser = await prisma.user.create({
      data: {
        auth0Sub: 'google-oauth2|117420300508488218630', // Standard Google OAuth format
        email: 'jonchyatt@gmail.com',
        name: 'Jon Hyatt',
        role: 'admin',
        accessLevel: 'admin',
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    console.log('✅ User created successfully!')
    console.log(`   ID: ${newUser.id}`)
    console.log(`   Email: ${newUser.email}`)
    console.log(`   Auth0 ID: ${newUser.auth0Sub}`)
    console.log(`   Role: ${newUser.role}`)
    console.log(`   Access Level: ${newUser.accessLevel}`)

  } catch (error: any) {
    if (error.code === 'P2002') {
      console.log('⚠️ User already exists with that Auth0 ID')
    } else {
      console.error('❌ Error creating user:', error)
    }
  } finally {
    await prisma.$disconnect()
  }
}

createUser()