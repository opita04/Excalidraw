import { NextRequest, NextResponse } from 'next/server'

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

    // Fetch the drawing data
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch drawing: HTTP ${response.status}`)
    }

    const drawingData = await response.json()

    // Generate SVG thumbnail
    let svg
    try {
      svg = generateThumbnailSVG(drawingData)
    } catch (error) {
      // Return a simple error SVG
      svg = `<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="200" fill="#f3f4f6"/>
        <text x="200" y="100" text-anchor="middle" fill="#6b7280" font-family="Arial" font-size="14">Preview error</text>
      </svg>`
    }

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    })
  } catch (error) {
      // Return a simple placeholder SVG on error
      const errorSvg = `<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="200" fill="#f3f4f6"/>
        <text x="200" y="100" text-anchor="middle" fill="#6b7280" font-family="Arial" font-size="14">Preview unavailable</text>
      </svg>`

    return new NextResponse(errorSvg, {
      headers: {
        'Content-Type': 'image/svg+xml',
      },
    })
  }
}

function generateThumbnailSVG(drawingData: any): string {
  const width = 400
  const height = 200
  let elements = drawingData.elements || []

  // Get background color from appState
  const backgroundColor = drawingData.appState?.viewBackgroundColor || '#ffffff'

  // For complex drawings, prioritize and show actual content
  const maxElements = 50
  if (elements.length > maxElements) {
    // Sort elements by priority: text > shapes > lines/arrows
    const priorityOrder = { text: 1, rectangle: 2, ellipse: 2, diamond: 2, line: 3, draw: 3, arrow: 3 }
    elements = elements
      .map((el: any, index: number) => ({ ...el, originalIndex: index }))
      .sort((a: any, b: any) => {
        const priorityA = priorityOrder[a.type] || 99
        const priorityB = priorityOrder[b.type] || 99
        if (priorityA !== priorityB) return priorityA - priorityB
        return a.originalIndex - b.originalIndex
      })
      .slice(0, maxElements)
  }

  // Calculate bounds of all elements to create a better viewBox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  elements.forEach((element: any, index: number) => {
    if (element.x !== undefined && element.y !== undefined) {
      minX = Math.min(minX, element.x)
      minY = Math.min(minY, element.y)
      maxX = Math.max(maxX, element.x + (element.width || 0))
      maxY = Math.max(maxY, element.y + (element.height || 0))
    }
  })

  // If no elements or invalid bounds, use default viewBox
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    minX = 0
    minY = 0
    maxX = 1000
    maxY = 1000
  }

  const viewBoxWidth = Math.max(100, maxX - minX)
  const viewBoxHeight = Math.max(100, maxY - minY)

  let svgContent = ''

  // Process elements and convert to simple SVG
  elements.forEach((element: any, index: number) => {
    try {
      // Validate numeric values
      const validateNumber = (val: any, defaultVal: number = 0) => {
        const num = Number(val)
        return isFinite(num) ? num : defaultVal
      }

      if (element.type === 'rectangle') {
        const x = validateNumber(element.x)
        const y = validateNumber(element.y)
        const width = Math.max(1, validateNumber(element.width, 100))
        const height = Math.max(1, validateNumber(element.height, 100))
        svgContent += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${element.backgroundColor || 'transparent'}" stroke="${element.strokeColor || '#000000'}" stroke-width="${Math.max(2, validateNumber(element.strokeWidth, 1))}"/>`
      } else if (element.type === 'ellipse') {
        const x = validateNumber(element.x)
        const y = validateNumber(element.y)
        const width = Math.max(1, validateNumber(element.width, 100))
        const height = Math.max(1, validateNumber(element.height, 100))
        svgContent += `<ellipse cx="${x + width/2}" cy="${y + height/2}" rx="${width/2}" ry="${height/2}" fill="${element.backgroundColor || 'transparent'}" stroke="${element.strokeColor || '#000000'}" stroke-width="${Math.max(2, validateNumber(element.strokeWidth, 1))}"/>`
      } else if (element.type === 'text') {
        const x = validateNumber(element.x)
        const y = validateNumber(element.y)
        const fontSize = Math.max(8, Math.min(16, validateNumber(element.fontSize, 16)))
        const safeText = (element.text || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
          .replace(/\n/g, ' ')
          .replace(/\r/g, ' ')
          .replace(/\t/g, ' ')
          .substring(0, 100) // Limit text length for thumbnails
        
        if (safeText.trim()) {
          svgContent += `<text x="${x}" y="${y + fontSize}" fill="${element.strokeColor || '#000000'}" font-family="${element.fontFamily || 'Arial'}" font-size="${fontSize}" font-weight="bold">${safeText}</text>`
        }
      } else if (element.type === 'line' || element.type === 'draw') {
        // For lines and freehand, create a simple path
        if (element.points && element.points.length > 0) {
          const x = validateNumber(element.x)
          const y = validateNumber(element.y)
          const pathData = element.points.map((point: number[], index: number) => {
            const px = validateNumber(point[0])
            const py = validateNumber(point[1])
            return index === 0 ? `M ${x + px} ${y + py}` : `L ${x + px} ${y + py}`
          }).join(' ')

          svgContent += `<path d="${pathData}" fill="none" stroke="${element.strokeColor || '#000000'}" stroke-width="${Math.max(2, validateNumber(element.strokeWidth, 1))}"/>`
        }
      } else if (element.type === 'arrow') {
        // Handle arrows as lines
        if (element.points && element.points.length >= 2) {
          const x = validateNumber(element.x)
          const y = validateNumber(element.y)
          const startPoint = element.points[0]
          const endPoint = element.points[element.points.length - 1]

          if (startPoint && endPoint) {
            const x1 = x + validateNumber(startPoint[0])
            const y1 = y + validateNumber(startPoint[1])
            const x2 = x + validateNumber(endPoint[0])
            const y2 = y + validateNumber(endPoint[1])

            svgContent += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${element.strokeColor || '#000000'}" stroke-width="${Math.max(2, validateNumber(element.strokeWidth, 1))}"/>`
          }
        }
      } else if (element.type === 'diamond') {
        // Handle diamonds as rectangles for now
        const x = validateNumber(element.x)
        const y = validateNumber(element.y)
        const width = Math.max(1, validateNumber(element.width, 100))
        const height = Math.max(1, validateNumber(element.height, 100))

        svgContent += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${element.backgroundColor || 'transparent'}" stroke="${element.strokeColor || '#000000'}" stroke-width="${Math.max(2, validateNumber(element.strokeWidth, 1))}"/>`
      }
    } catch (elementError) {
      // Skip problematic elements silently
    }
  })

  // Create the SVG with better scaling
  const svg = `<svg width="${width}" height="${height}" viewBox="${minX} ${minY} ${viewBoxWidth} ${viewBoxHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${minX}" y="${minY}" width="${viewBoxWidth}" height="${viewBoxHeight}" fill="${backgroundColor}"/>
    ${svgContent}
  </svg>`

  // Basic validation - ensure SVG has required structure
  if (!svg.includes('<svg') || !svg.includes('</svg>')) {
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#f3f4f6"/>
      <text x="${width/2}" y="${height/2}" text-anchor="middle" fill="#6b7280" font-family="Arial" font-size="14">Preview error</text>
    </svg>`
  }

  return svg
}
