import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export async function POST(request: NextRequest) {
  try {
    // Check if blob token is available
    if (!process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN === 'placeholder_token_for_local_dev') {
      return NextResponse.json(
        { 
          error: 'Blob storage not configured',
          message: 'Please deploy to Vercel and configure BLOB_READ_WRITE_TOKEN environment variable'
        },
        { status: 503 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Upload to Vercel Blob
    const blob = await put(file.name, file, {
      access: 'public',
    })

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      uploadedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error saving drawing:', error)
    return NextResponse.json(
      { error: 'Failed to save drawing' },
      { status: 500 }
    )
  }
}
