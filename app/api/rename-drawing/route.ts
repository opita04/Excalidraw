import { NextRequest, NextResponse } from 'next/server'
import { del, put } from '@vercel/blob'

export async function PATCH(request: NextRequest) {
  try {

    const { searchParams } = new URL(request.url)
    const oldUrl = searchParams.get('url')
    const newName = searchParams.get('name')

    if (!oldUrl || !newName) {
      return NextResponse.json(
        { error: 'Missing url or name parameter' },
        { status: 400 }
      )
    }


    // Check if blob token is available
    if (!process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN === 'placeholder_token_for_local_dev') {
      console.log('rename-drawing: Blob token not configured properly')
      return NextResponse.json(
        {
          error: 'Blob storage not configured',
          message: 'Please deploy to Vercel and configure BLOB_READ_WRITE_TOKEN environment variable'
        },
        { status: 503 }
      )
    }

    // Fetch the existing drawing using the load-drawing API
    const response = await fetch(`/api/load-drawing?url=${encodeURIComponent(oldUrl)}`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Failed to load existing drawing: ${errorData.error || `HTTP ${response.status}`}`)
    }

    const drawingData = await response.json()

    // Upload with new name
    const jsonData = JSON.stringify(drawingData)
    const blob = new Blob([jsonData], { type: 'application/json' })
    const formData = new FormData()
    formData.append('file', blob, `${newName}.json`)

    const uploadResponse = await fetch('/api/save-drawing', {
      method: 'POST',
      body: formData
    })

    if (!uploadResponse.ok) {
      throw new Error(`Failed to save renamed drawing: HTTP ${uploadResponse.status}`)
    }

    const uploadResult = await uploadResponse.json()

    // Delete the old drawing
    await del(oldUrl)

    return NextResponse.json({
      success: true,
      message: 'Drawing renamed successfully',
      newUrl: uploadResult.url,
      newName: newName
    })
  } catch (error) {
    console.error('Error renaming drawing:', error)
    return NextResponse.json(
      { error: 'Failed to rename drawing' },
      { status: 500 }
    )
  }
}
