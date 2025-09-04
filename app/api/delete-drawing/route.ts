import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'

export async function DELETE(request: NextRequest) {
  try {

    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    if (!url) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      )
    }


    // Check if blob token is available
    if (!process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN === 'placeholder_token_for_local_dev') {
      console.log('delete-drawing: Blob token not configured properly')
      return NextResponse.json(
        {
          error: 'Blob storage not configured',
          message: 'Please deploy to Vercel and configure BLOB_READ_WRITE_TOKEN environment variable'
        },
        { status: 503 }
      )
    }

    // Delete the blob
    await del(url)


    return NextResponse.json({
      success: true,
      message: 'Drawing deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting drawing:', error)
    return NextResponse.json(
      { error: 'Failed to delete drawing' },
      { status: 500 }
    )
  }
}
