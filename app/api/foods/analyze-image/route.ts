import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { compressImageForAI, base64ToBuffer, estimateVisionCost } from '@/lib/imageUtils'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Nutrition analysis prompt (adapted from n8n workflow)
const NUTRITION_ANALYSIS_PROMPT = `You are a professional nutrition analyst. Your goal is to analyze this food photo for each visible item and output a structured JSON with clear calorie and macro estimates.

CORE FUNCTIONALITY
• When shown a food image, identify each item and its main components (protein, carb, fat, etc.)
• Assume a standard reference (e.g. 26 cm dinner plate, 250 ml cup, standard fork) for scale
• Note if it looks like a restaurant-prepared dish—if so, assume extra cooking fat: sauté or sauce fat up by ~1 Tbsp (14 g) per portion

• Estimate portion sizes in grams. Use reference cues in the image (cups, standard glass size, bread size, common utensils) to scale portions.
• Make assumptions realistic. Prefer common serving sizes.
• List any assumptions (shape, density, coverage %) you use to estimate size
• Estimate calories & macros per item using trusted databases (USDA FoodData Central, European equivalents), adjusting for added restaurant fat
• Note visible cooking methods or add-ins (oil, sauce, butter)
• Calculate calories for each item, giving a plausible range
• Sum to a total calories range

JSON OUTPUT SCHEMA

{
  "overview": "Brief sentence about the full plate or spread",
  "short_name": "burger with fries",
  "items": [
    {
      "name": "Item name",
      "type": "protein | carb | fat | beverage | etc.",
      "portion_size": "e.g. 1 cup, 2 slices",
      "cooking_method": "if obvious",
      "macros_g": {
        "protein": 0,
        "carbs": 0,
        "fat": 0
      },
      "calories_kcal": {
        "low": 0,
        "high": 0
      },
      "assumptions": "Any guesses you made"
    }
  ],
  "total_calories_kcal": {
    "low": 0,
    "high": 0
  },
  "total_macros": {
      "proteins": {
        "low": 0,
        "high": 0
      },
      "carbs": {
        "low": 0,
        "high": 0
      },
      "fat": {
        "low": 0,
        "high": 0
      }
    },
  "notes": "Any limitations or 'estimate may vary' warnings"
}

FOOD ANALYSIS GUIDELINES
• Start with "overview" for the whole meal
• For each item, fill every field in the schema
• Give calories as a low–high range
• Explain assumptions in the "assumptions" field
• If unsure or image is unclear, add warnings in "notes"`

/**
 * POST /api/foods/analyze-image
 *
 * Analyzes food image using GPT-4o-mini Vision
 * Returns structured nutrition data
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Check daily rate limit (10 images/day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const usageCount = await prisma.aIUsage.count({
      where: {
        userId: user.id,
        type: 'image',
        createdAt: { gte: today }
      }
    })

    if (usageCount >= 10) {
      return NextResponse.json({
        error: 'Daily limit reached',
        message: 'You have reached your daily limit of 10 image analyses. Try again tomorrow!'
      }, { status: 429 })
    }

    // 3. Parse request body
    const body = await req.json()
    const { imageBase64, mealType = 'snack' } = body

    if (!imageBase64) {
      return NextResponse.json({ error: 'Image required' }, { status: 400 })
    }

    // 4. Compress image to reduce API costs
    const imageBuffer = base64ToBuffer(imageBase64)
    const compressedBase64 = await compressImageForAI(imageBuffer)

    // 5. Call OpenAI Vision API with GPT-4o-mini
    const startTime = Date.now()

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: NUTRITION_ANALYSIS_PROMPT
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${compressedBase64}`,
                detail: 'low' // Use low detail for cost savings
              }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' }, // Guaranteed JSON response
      max_tokens: 2000
    })

    const responseTime = Date.now() - startTime

    // 6. Parse AI response
    const analysis = JSON.parse(response.choices[0].message.content || '{}')

    // 7. Calculate averaged values from ranges
    const avgCalories = (analysis.total_calories_kcal.high + analysis.total_calories_kcal.low) / 2
    const avgProtein = (analysis.total_macros.proteins.high + analysis.total_macros.proteins.low) / 2
    const avgCarbs = (analysis.total_macros.carbs.high + analysis.total_macros.carbs.low) / 2
    const avgFat = (analysis.total_macros.fat.high + analysis.total_macros.fat.low) / 2

    // 8. Track AI usage
    const estimatedCost = estimateVisionCost('low')

    await prisma.aIUsage.create({
      data: {
        userId: user.id,
        type: 'image',
        model: 'gpt-4o-mini',
        tokensUsed: response.usage?.total_tokens || 0,
        cost: estimatedCost,
        success: true,
        metadata: {
          responseTime,
          imageSize: imageBuffer.length,
          compressedSize: Buffer.from(compressedBase64, 'base64').length
        }
      }
    })

    // 9. Return structured response
    return NextResponse.json({
      ok: true,
      analysis,
      foodEntry: {
        itemName: analysis.short_name,
        brand: null,
        quantity: 1,
        unit: 'serving',
        gramWeight: null,
        mealType,
        nutrients: {
          kcal: avgCalories,
          protein_g: avgProtein,
          carb_g: avgCarbs,
          fat_g: avgFat
        },
        aiMetadata: analysis,
        confidence: 0.8, // Could be calculated from range width
        aiSource: 'vision'
      },
      usage: {
        dailyCount: usageCount + 1,
        dailyLimit: 10,
        remainingToday: 9 - usageCount
      }
    })

  } catch (error: any) {
    console.error('AI image analysis error:', error)

    // Track failed usage
    try {
      const session = await auth0.getSession()
      const user = await getUserFromSession(session)

      if (user) {
        await prisma.aIUsage.create({
          data: {
            userId: user.id,
            type: 'image',
            model: 'gpt-4o-mini',
            tokensUsed: 0,
            cost: 0,
            success: false,
            errorMsg: error.message
          }
        })
      }
    } catch (trackingError) {
      console.error('Failed to track error:', trackingError)
    }

    return NextResponse.json({
      error: 'AI analysis failed',
      message: error.message || 'Unable to analyze image'
    }, { status: 500 })
  }
}
