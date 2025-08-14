import { NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export async function GET() {
  try {
    // Check if blob token is available
    if (!process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN === 'placeholder_token_for_local_dev') {
      return NextResponse.json(
        { 
          error: 'Blob storage not configured',
          message: 'Please deploy to Vercel and configure BLOB_READ_WRITE_TOKEN environment variable',
          drawings: []
        },
        { status: 503 }
      )
    }

    // List all blobs in the store
    const { blobs } = await list()
    
    // Filter for drawing files and format the response
    const drawings = blobs
      .filter(blob => blob.pathname.endsWith('.json'))
      .map(blob => ({
        url: blob.url,
        name: blob.pathname,
        size: blob.size,
        uploadedAt: blob.uploadedAt,
      }))
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())

    return NextResponse.json(drawings)
  } catch (error) {
    console.error('Error listing drawings:', error)
    return NextResponse.json(
      { error: 'Failed to list drawings' },
      { status: 500 }
    )
  }
}
