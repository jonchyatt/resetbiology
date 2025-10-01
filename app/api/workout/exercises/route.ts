import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

// Default exercise library (can be imported)
const defaultExercises = [
  // Chest
  { name: "Bench Press", category: "Chest", equipment: "Barbell", primaryMuscle: "Chest" },
  { name: "Dumbbell Press", category: "Chest", equipment: "Dumbbell", primaryMuscle: "Chest" },
  { name: "Incline Bench Press", category: "Chest", equipment: "Barbell", primaryMuscle: "Upper Chest" },
  { name: "Cable Fly", category: "Chest", equipment: "Cable", primaryMuscle: "Chest" },
  { name: "Push-Up", category: "Chest", equipment: "Bodyweight", primaryMuscle: "Chest" },

  // Back
  { name: "Pull-Up", category: "Back", equipment: "Bodyweight", primaryMuscle: "Lats" },
  { name: "Deadlift", category: "Back", equipment: "Barbell", primaryMuscle: "Back" },
  { name: "Barbell Row", category: "Back", equipment: "Barbell", primaryMuscle: "Back" },
  { name: "Lat Pulldown", category: "Back", equipment: "Cable", primaryMuscle: "Lats" },
  { name: "Cable Row", category: "Back", equipment: "Cable", primaryMuscle: "Back" },

  // Shoulders
  { name: "Overhead Press", category: "Shoulders", equipment: "Barbell", primaryMuscle: "Shoulders" },
  { name: "Dumbbell Shoulder Press", category: "Shoulders", equipment: "Dumbbell", primaryMuscle: "Shoulders" },
  { name: "Lateral Raise", category: "Shoulders", equipment: "Dumbbell", primaryMuscle: "Side Delts" },
  { name: "Face Pull", category: "Shoulders", equipment: "Cable", primaryMuscle: "Rear Delts" },

  // Legs
  { name: "Squat", category: "Legs", equipment: "Barbell", primaryMuscle: "Quads" },
  { name: "Leg Press", category: "Legs", equipment: "Machine", primaryMuscle: "Quads" },
  { name: "Romanian Deadlift", category: "Legs", equipment: "Barbell", primaryMuscle: "Hamstrings" },
  { name: "Leg Curl", category: "Legs", equipment: "Machine", primaryMuscle: "Hamstrings" },
  { name: "Calf Raise", category: "Legs", equipment: "Machine", primaryMuscle: "Calves" },
  { name: "Lunges", category: "Legs", equipment: "Dumbbell", primaryMuscle: "Quads" },

  // Arms
  { name: "Barbell Curl", category: "Arms", equipment: "Barbell", primaryMuscle: "Biceps" },
  { name: "Hammer Curl", category: "Arms", equipment: "Dumbbell", primaryMuscle: "Biceps" },
  { name: "Tricep Extension", category: "Arms", equipment: "Dumbbell", primaryMuscle: "Triceps" },
  { name: "Close-Grip Bench Press", category: "Arms", equipment: "Barbell", primaryMuscle: "Triceps" },
  { name: "Cable Tricep Pushdown", category: "Arms", equipment: "Cable", primaryMuscle: "Triceps" },

  // Core
  { name: "Plank", category: "Core", equipment: "Bodyweight", primaryMuscle: "Abs" },
  { name: "Crunches", category: "Core", equipment: "Bodyweight", primaryMuscle: "Abs" },
  { name: "Russian Twist", category: "Core", equipment: "Bodyweight", primaryMuscle: "Obliques" },
  { name: "Leg Raises", category: "Core", equipment: "Bodyweight", primaryMuscle: "Lower Abs" },
  { name: "Cable Crunch", category: "Core", equipment: "Cable", primaryMuscle: "Abs" }
]

// GET: Load exercise library (default + custom)
export async function GET(request: Request) {
  try {
    const session = await auth0.getSession()

    // Exercise library can be public, but custom exercises need auth
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const customOnly = searchParams.get('customOnly') === 'true'

    let exercises = [...defaultExercises]

    // If user is logged in, add their custom exercises
    if (session?.user) {
      let user = await prisma.user.findUnique({
        where: { auth0Sub: session.user.sub }
      })

      if (!user && session.user.email) {
        user = await prisma.user.findUnique({
          where: { email: session.user.email }
        })
      }

      if (user) {
        // For now, store custom exercises in user's profileData JSON
        // In production, create a separate Exercise model
        const customExercises = user.profileData?.customExercises || []
        if (customOnly) {
          exercises = customExercises
        } else {
          exercises = [...exercises, ...customExercises]
        }
      }
    }

    // Filter by category
    if (category && category !== 'all') {
      exercises = exercises.filter(ex => ex.category.toLowerCase() === category.toLowerCase())
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      exercises = exercises.filter(ex =>
        ex.name.toLowerCase().includes(searchLower) ||
        ex.category.toLowerCase().includes(searchLower) ||
        ex.primaryMuscle?.toLowerCase().includes(searchLower)
      )
    }

    return NextResponse.json({
      success: true,
      exercises,
      total: exercises.length
    })

  } catch (error) {
    console.error('GET /api/workout/exercises error:', error)
    return NextResponse.json({
      error: 'Failed to load exercises',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST: Add custom exercise or bulk import
export async function POST(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email }
      })

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { auth0Sub: session.user.sub }
        })
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { exercises, importType } = body

    // Handle bulk import
    if (importType === 'bulk' && Array.isArray(exercises)) {
      // Get existing custom exercises
      const existingCustom = user.profileData?.customExercises || []

      // Add new exercises (avoid duplicates)
      const newExercises = exercises.filter(newEx =>
        !existingCustom.some(ex => ex.name === newEx.name)
      )

      const updatedCustom = [...existingCustom, ...newExercises]

      // Update user's custom exercises
      await prisma.user.update({
        where: { id: user.id },
        data: {
          profileData: {
            ...user.profileData,
            customExercises: updatedCustom
          }
        }
      })

      return NextResponse.json({
        success: true,
        imported: newExercises.length,
        skipped: exercises.length - newExercises.length,
        message: `Imported ${newExercises.length} exercises, skipped ${exercises.length - newExercises.length} duplicates`
      })
    }

    // Handle single exercise
    const { name, category, equipment, primaryMuscle } = body

    if (!name || !category) {
      return NextResponse.json({
        error: 'Missing required fields: name, category'
      }, { status: 400 })
    }

    const newExercise = {
      name,
      category,
      equipment: equipment || 'None',
      primaryMuscle: primaryMuscle || category
    }

    // Get existing custom exercises
    const customExercises = user.profileData?.customExercises || []

    // Check for duplicate
    if (customExercises.some(ex => ex.name === name)) {
      return NextResponse.json({
        error: 'Exercise already exists'
      }, { status: 400 })
    }

    // Add new exercise
    customExercises.push(newExercise)

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        profileData: {
          ...user.profileData,
          customExercises
        }
      }
    })

    return NextResponse.json({
      success: true,
      exercise: newExercise
    })

  } catch (error) {
    console.error('POST /api/workout/exercises error:', error)
    return NextResponse.json({
      error: 'Failed to add exercise',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE: Remove custom exercise
export async function DELETE(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const exerciseName = searchParams.get('name')

    if (!exerciseName) {
      return NextResponse.json({
        error: 'Missing exercise name'
      }, { status: 400 })
    }

    // Get existing custom exercises
    const customExercises = user.profileData?.customExercises || []

    // Remove the exercise
    const filtered = customExercises.filter(ex => ex.name !== exerciseName)

    if (filtered.length === customExercises.length) {
      return NextResponse.json({
        error: 'Exercise not found'
      }, { status: 404 })
    }

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        profileData: {
          ...user.profileData,
          customExercises: filtered
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `Removed exercise: ${exerciseName}`
    })

  } catch (error) {
    console.error('DELETE /api/workout/exercises error:', error)
    return NextResponse.json({
      error: 'Failed to remove exercise',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}