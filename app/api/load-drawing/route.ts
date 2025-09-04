import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('load-drawing: Processing load request...')

    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    if (!url) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      )
    }

    console.log('load-drawing: Fetching drawing from URL:', url)

    // Fetch the drawing from Vercel Blob
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      }
    })

    if (!response.ok) {
      console.error('load-drawing: Failed to fetch from blob:', response.status, response.statusText)
      throw new Error(`Failed to fetch drawing: HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type')

    // Get the raw text content
    const textContent = await response.text()

    let drawingData
    try {
      // Parse the JSON content
      drawingData = JSON.parse(textContent)
    } catch (parseError) {
      console.error('load-drawing: Failed to parse JSON:', parseError)
      throw new Error(`Invalid JSON data in drawing file: ${parseError.message}`)
    }

    // Validate the drawing data structure
    if (!drawingData || typeof drawingData !== 'object') {
      throw new Error('Invalid drawing data structure - not an object')
    }

    // Ensure the data has the required Excalidraw structure
    if (!drawingData.type || drawingData.type !== 'excalidraw') {
      console.warn('load-drawing: Missing or invalid type field, adding default')
      drawingData.type = 'excalidraw'
    }

    if (!drawingData.version) {
      console.warn('load-drawing: Missing version field, adding default')
      drawingData.version = 2
    }

    if (!drawingData.elements || !Array.isArray(drawingData.elements)) {
      console.warn('load-drawing: Missing or invalid elements array, using empty array')
      drawingData.elements = []
    }

    if (!drawingData.appState || typeof drawingData.appState !== 'object') {
      console.warn('load-drawing: Missing or invalid appState, using default')
      drawingData.appState = {}
    }
    
    // Ensure appState has required fields for Excalidraw
    if (!drawingData.appState.collaborators) {
      drawingData.appState.collaborators = {}
    }

    if (!drawingData.files) {
      console.warn('load-drawing: Missing files field, adding empty object')
      drawingData.files = {}
    }


    return NextResponse.json(drawingData)
  } catch (error) {
    console.error('Error loading drawing:', error)
    return NextResponse.json(
      { error: 'Failed to load drawing', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
