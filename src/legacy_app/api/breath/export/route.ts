import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    // For now, return error since authentication is not implemented
    return NextResponse.json(
      { error: "Google Sheets export temporarily unavailable. Authentication system is being updated." },
      { status: 503 }
    )
  } catch (error) {
    console.error("Export error:", error)
    return NextResponse.json(
      { error: "Failed to export breath training data" },
      { status: 500 }
    )
  }
}