import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'

// Common foods database (can be expanded)
const commonFoods = [
  // Proteins
  { name: "Chicken Breast", calories: 165, protein: 31, carbs: 0, fats: 3.6, category: "protein", serving: "100g" },
  { name: "Salmon", calories: 208, protein: 20, carbs: 0, fats: 13, category: "protein", serving: "100g" },
  { name: "Eggs", calories: 155, protein: 13, carbs: 1.1, fats: 11, category: "protein", serving: "100g" },
  { name: "Greek Yogurt", calories: 59, protein: 10, carbs: 3.6, fats: 0.4, category: "dairy", serving: "100g" },
  { name: "Tofu", calories: 76, protein: 8, carbs: 1.9, fats: 4.8, category: "protein", serving: "100g" },

  // Carbs
  { name: "White Rice", calories: 130, protein: 2.7, carbs: 28, fats: 0.3, category: "carbs", serving: "100g" },
  { name: "Brown Rice", calories: 111, protein: 2.6, carbs: 23, fats: 0.9, category: "carbs", serving: "100g" },
  { name: "Sweet Potato", calories: 86, protein: 1.6, carbs: 20, fats: 0.1, category: "carbs", serving: "100g" },
  { name: "Oatmeal", calories: 389, protein: 16.9, carbs: 66.3, fats: 6.9, category: "carbs", serving: "100g" },
  { name: "Quinoa", calories: 120, protein: 4.4, carbs: 21.3, fats: 1.9, category: "carbs", serving: "100g" },

  // Fats
  { name: "Avocado", calories: 160, protein: 2, carbs: 9, fats: 15, category: "fats", serving: "100g" },
  { name: "Almonds", calories: 579, protein: 21, carbs: 22, fats: 50, category: "fats", serving: "100g" },
  { name: "Olive Oil", calories: 884, protein: 0, carbs: 0, fats: 100, category: "fats", serving: "100g" },
  { name: "Peanut Butter", calories: 588, protein: 25, carbs: 20, fats: 50, category: "fats", serving: "100g" },

  // Vegetables
  { name: "Broccoli", calories: 34, protein: 2.8, carbs: 6.6, fats: 0.4, category: "vegetables", serving: "100g" },
  { name: "Spinach", calories: 23, protein: 2.9, carbs: 3.6, fats: 0.4, category: "vegetables", serving: "100g" },
  { name: "Carrots", calories: 41, protein: 0.9, carbs: 10, fats: 0.2, category: "vegetables", serving: "100g" },
  { name: "Bell Peppers", calories: 31, protein: 1, carbs: 6, fats: 0.3, category: "vegetables", serving: "100g" },

  // Fruits
  { name: "Apple", calories: 52, protein: 0.3, carbs: 14, fats: 0.2, category: "fruits", serving: "100g" },
  { name: "Banana", calories: 89, protein: 1.1, carbs: 23, fats: 0.3, category: "fruits", serving: "100g" },
  { name: "Blueberries", calories: 57, protein: 0.7, carbs: 14, fats: 0.3, category: "fruits", serving: "100g" },
  { name: "Orange", calories: 47, protein: 0.9, carbs: 12, fats: 0.1, category: "fruits", serving: "100g" }
]

// GET: Search foods (default + custom)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const customOnly = searchParams.get('customOnly') === 'true'

    let foods = [...commonFoods]

    // If user is logged in, add their custom foods
    const session = await auth0.getSession()
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
        // Get custom foods from user's profileData
        const profileData = user.profileData as any
        const customFoods = profileData?.customFoods || []
        if (customOnly) {
          foods = customFoods
        } else {
          foods = [...foods, ...customFoods]
        }
      }
    }

    // Filter by category
    if (category && category !== 'all') {
      foods = foods.filter(food => food.category?.toLowerCase() === category.toLowerCase())
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      foods = foods.filter(food =>
        food.name.toLowerCase().includes(searchLower) ||
        food.category?.toLowerCase().includes(searchLower)
      )
    }

    return NextResponse.json({
      success: true,
      foods,
      total: foods.length
    })

  } catch (error) {
    console.error('GET /api/nutrition/foods error:', error)
    return NextResponse.json({
      error: 'Failed to search foods',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST: Add custom food or bulk import
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
    const { foods: foodsToImport, importType } = body

    // Handle bulk import
    if (importType === 'bulk' && Array.isArray(foodsToImport)) {
      // Get existing custom foods
      const profileData = user.profileData as any
      const existingCustom = profileData?.customFoods || []

      // Add new foods (avoid duplicates by name)
      const newFoods = foodsToImport.filter((newFood: any) =>
        !existingCustom.some((food: any) => food.name === newFood.name)
      )

      const updatedCustom = [...existingCustom, ...newFoods]

      // Update user's custom foods
      await prisma.user.update({
        where: { id: user.id },
        data: {
          profileData: {
            ...(user.profileData as any || {}),
            customFoods: updatedCustom
          }
        }
      })

      return NextResponse.json({
        success: true,
        imported: newFoods.length,
        skipped: foodsToImport.length - newFoods.length,
        message: `Imported ${newFoods.length} foods, skipped ${foodsToImport.length - newFoods.length} duplicates`
      })
    }

    // Handle single food
    const { name, calories, protein, carbs, fats, category, serving } = body

    if (!name || calories === undefined || protein === undefined || carbs === undefined || fats === undefined) {
      return NextResponse.json({
        error: 'Missing required fields: name, calories, protein, carbs, fats'
      }, { status: 400 })
    }

    const newFood = {
      name,
      calories: parseFloat(calories),
      protein: parseFloat(protein),
      carbs: parseFloat(carbs),
      fats: parseFloat(fats),
      category: category || 'custom',
      serving: serving || '100g'
    }

    // Get existing custom foods
    const profileData = user.profileData as any
    const customFoods = profileData?.customFoods || []

    // Check for duplicate
    if (customFoods.some((food: any) => food.name === name)) {
      return NextResponse.json({
        error: 'Food already exists'
      }, { status: 400 })
    }

    // Add new food
    customFoods.push(newFood)

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        profileData: {
          ...(user.profileData as any || {}),
          customFoods
        }
      }
    })

    return NextResponse.json({
      success: true,
      food: newFood
    })

  } catch (error) {
    console.error('POST /api/nutrition/foods error:', error)
    return NextResponse.json({
      error: 'Failed to add food',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE: Remove custom food
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
    const foodName = searchParams.get('name')

    if (!foodName) {
      return NextResponse.json({
        error: 'Missing food name'
      }, { status: 400 })
    }

    // Get existing custom foods
    const profileData = user.profileData as any
    const customFoods = profileData?.customFoods || []

    // Remove the food
    const filtered = customFoods.filter((food: any) => food.name !== foodName)

    if (filtered.length === customFoods.length) {
      return NextResponse.json({
        error: 'Food not found'
      }, { status: 404 })
    }

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        profileData: {
          ...(user.profileData as any || {}),
          customFoods: filtered
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `Removed food: ${foodName}`
    })

  } catch (error) {
    console.error('DELETE /api/nutrition/foods error:', error)
    return NextResponse.json({
      error: 'Failed to remove food',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}