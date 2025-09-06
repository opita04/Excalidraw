import { NextRequest, NextResponse } from 'next/server'
import { put, del } from '@vercel/blob'

export async function POST(request: NextRequest) {
  try {
    console.log('save-drawing: Checking environment variables...')
    console.log('BLOB_READ_WRITE_TOKEN exists:', Boolean(process.env.BLOB_READ_WRITE_TOKEN))
    console.log('BLOB_READ_WRITE_TOKEN value:', process.env.BLOB_READ_WRITE_TOKEN?.substring(0, 10) + '...')

    // Check if blob token is available
    if (!process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN === 'placeholder_token_for_local_dev') {
      console.log('save-drawing: Blob token not configured properly')
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
        console.log('save-drawing: Deleting existing drawing:', existingUrl)
        await del(existingUrl)
      } catch (deleteError) {
        console.warn('save-drawing: Failed to delete existing drawing:', deleteError)
        // Continue with save even if delete fails
      }
    }

    console.log('save-drawing: Uploading file:', file.name, 'Size:', file.size)

    // Parse and validate the content
    try {
      const fileContent = await file.text()
      JSON.parse(fileContent) // Validate JSON
    } catch (parseError) {
      console.error('save-drawing: Failed to parse file content:', parseError)
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
