export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { assessmentData, assessmentId } = body

    // Store assessment data for IRB handoff
    const irbReferenceId = `RB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Update assessment with IRB submission status
    // await prisma.assessment.update({
    //   where: { id: assessmentId },
    //   data: { 
    //     irbSubmitted: true,
    //     irbReferenceId: irbReferenceId,
    //     irbSubmissionData: JSON.stringify(assessmentData)
    //   }
    // })
    
    console.log('IRB Handoff Data:', {
      referenceId: irbReferenceId,
      assessmentScore: assessmentData.assessmentScore,
      urgencyLevel: assessmentData.urgencyLevel,
      timestamp: new Date().toISOString()
    })

    // TODO: Implement actual cellularpeptide.com API integration
    // This would include:
    // 1. Formatting assessment data for their system
    // 2. Secure API call to their IRB application endpoint
    // 3. Handling response and storing reference ID
    // 4. Setting up webhook for status updates

    // Simulate cellularpeptide.com response with psychological elements
    const cellularPeptideResponse = {
      success: true,
      referenceId: irbReferenceId,
      estimatedReviewTime: assessmentData.urgencyLevel === 'high' ? '12-24 hours' : '24-48 hours',
      urgencyMessage: assessmentData.urgencyLevel === 'high' ? 
        'High priority case - expedited medical review initiated' :
        'Standard review timeline - medical team has been notified',
      nextSteps: [
        `Secure data transfer to IRB partner completed at ${new Date().toLocaleTimeString()}`,
        'Licensed medical provider review in progress',
        'IRB protocol compliance verification', 
        'Personalized Retatrutide protocol development',
        'Portal access with progress tracking activation'
      ]
    }

    return NextResponse.json({
      success: true,
      cellularPeptideResponse
    })

  } catch (error) {
    console.error('IRB handoff error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process IRB handoff' },
      { status: 500 }
    )
  }
}

// Webhook endpoint for cellularpeptide.com status updates
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { referenceId, status, approvalDate, treatmentPlan } = body

    // TODO: Verify webhook signature from cellularpeptide.com
    
    // Update user IRB status
    await prisma.user.updateMany({
      where: {
        // Find user by reference ID stored in their assessment
      },
      data: {
        irbApprovalStatus: status,
        // Store additional IRB response data
      }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('IRB webhook error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process IRB webhook' },
      { status: 500 }
    )
  }
}