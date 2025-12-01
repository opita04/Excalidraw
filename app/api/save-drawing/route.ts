import { NextRequest, NextResponse } from 'next/server'
import { put, del } from '@vercel/blob'

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
    const existingUrl = formData.get('existingUrl') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // If updating an existing drawing, delete the old one first
    if (existingUrl) {
      try {
        await del(existingUrl)
      } catch (deleteError) {
        // Continue with save even if delete fails
      }
    }

    // Parse and validate the content
    try {
      const fileContent = await file.text()
      JSON.parse(fileContent) // Validate JSON
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON content in file' },
        { status: 400 }
      )
    }

    // Upload to Vercel Blob with proper content type
    const blob = await put(file.name, file, {
      access: 'public',
      contentType: file.name.endsWith('.excalidraw') ? 'application/json' : 'application/json',
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
