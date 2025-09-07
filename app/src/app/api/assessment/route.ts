import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { AssessmentResponse } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { responses, userId } = body as { responses: AssessmentResponse[], userId?: string }

    // Calculate assessment score
    let totalScore = 0
    let maxScore = 0
    
    responses.forEach(response => {
      maxScore += response.weight || 1
      
      if (typeof response.answer === 'number') {
        totalScore += (response.answer / 10) * (response.weight || 1)
      } else if (response.answer === 'yes') {
        totalScore += response.weight || 1
      } else if (typeof response.answer === 'string') {
        // Weight certain responses for Retatrutide recommendation
        if (response.questionId === 'current-treatment' && 
            (response.answer.includes('Semaglutide') || response.answer.includes('Tirzepatide'))) {
          totalScore += response.weight || 1
        }
        if (response.questionId === 'muscle-loss') {
          totalScore += (response.weight || 1) * 1.5
        }
      }
    })

    const normalizedScore = (totalScore / maxScore) * 100

    // Generate recommendations
    const recommendations = []
    
    if (normalizedScore > 70) {
      recommendations.push("You're an excellent candidate for our IRB-approved Retatrutide protocol")
      recommendations.push("Consider our comprehensive Mental Mastery program for lasting results")
    }
    
    const muscleResponse = responses.find(r => r.questionId === 'muscle-loss')
    if (muscleResponse && typeof muscleResponse.answer === 'number' && muscleResponse.answer > 7) {
      recommendations.push("URGENT: Your current medication may be causing significant muscle loss")
    }
    
    const dependencyResponse = responses.find(r => r.questionId === 'dependency-concerns')
    if (dependencyResponse && typeof dependencyResponse.answer === 'number' && dependencyResponse.answer > 8) {
      recommendations.push("Our tapering protocol can help you achieve medication independence")
    }

    const results = {
      score: normalizedScore,
      recommendations,
      peptideRecommendation: normalizedScore > 60 ? 'Retatrutide Protocol' : 'Consultation Required',
      urgencyLevel: normalizedScore > 80 ? 'high' : normalizedScore > 60 ? 'medium' : 'low',
      irbEligible: normalizedScore > 50
    }

    // Store assessment in database
    const assessment = await prisma.assessment.create({
      data: {
        userId,
        responses: responses as any,
        results: results as any,
        irbSubmitted: false
      }
    })

    return NextResponse.json({ 
      success: true, 
      results,
      assessmentId: assessment.id
    })

  } catch (error) {
    console.error('Assessment API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process assessment' },
      { status: 500 }
    )
  }
}