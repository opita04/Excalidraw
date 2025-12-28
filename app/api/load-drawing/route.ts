import { NextRequest, NextResponse } from 'next/server'
import { head } from '@vercel/blob'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {

  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')


    if (!url) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      )
    }

    // Verify the blob exists using head
    try {
      await head(url)
    } catch (headError) {
      throw new Error(`Blob not found or inaccessible: ${headError instanceof Error ? headError.message : 'Unknown error'}`)
    }

    // Fetch the drawing from Vercel Blob with authorization if available
    const fetchHeaders: HeadersInit = {
      'Accept': 'application/json',
    }

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      fetchHeaders['Authorization'] = `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`
    }


    const response = await fetch(url, {
      headers: fetchHeaders
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch drawing: HTTP ${response.status} - ${response.statusText}`)
    }


    const textContent = await response.text()

    let drawingData
    try {
      drawingData = JSON.parse(textContent)
    } catch (parseError) {
      throw new Error(`Invalid JSON data in drawing file: ${parseError instanceof Error ? parseError.message : 'Parse error'}`)
    }


    // Validate the drawing data structure
    if (!drawingData || typeof drawingData !== 'object') {
      throw new Error('Invalid drawing data structure - not an object')
    }

    // Ensure the data has the required Excalidraw structure
    if (!drawingData.type || drawingData.type !== 'excalidraw') {
      drawingData.type = 'excalidraw'
    }

    if (!drawingData.version) {
      drawingData.version = 2
    }

    if (!drawingData.elements || !Array.isArray(drawingData.elements)) {
      drawingData.elements = []
    }

    if (!drawingData.appState || typeof drawingData.appState !== 'object') {
      drawingData.appState = {}
    }

    if (!drawingData.appState.collaborators) {
      drawingData.appState.collaborators = {}
    }

    if (!drawingData.files) {
      drawingData.files = {}
    }

    return NextResponse.json(drawingData)
  } catch (error) {
    console.error('Error loading drawing:', error)
    return NextResponse.json(
      {
        error: 'Failed to load drawing',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
