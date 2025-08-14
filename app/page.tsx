'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useCallback } from 'react'
import { ExcalidrawAPIRefValue } from '@excalidraw/excalidraw/types/types'

// Dynamically import Excalidraw to avoid SSR issues
const Excalidraw = dynamic(
  async () => {
    const { Excalidraw } = await import('@excalidraw/excalidraw')
    return Excalidraw
  },
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Excalidraw...</p>
        </div>
      </div>
    )
  }
)

export default function Home() {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawAPIRefValue | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    // Basic diagnostics to confirm mount
    console.log('ExcalidrawAPI set?', Boolean(excalidrawAPI))
  }, [excalidrawAPI])

  // Save drawing to blob storage
  const saveDrawing = useCallback(async () => {
    if (!excalidrawAPI) return

    try {
      setIsSaving(true)
      
      // Get the current scene data
      const sceneData = excalidrawAPI.getSceneData()
      
      // Convert to JSON string
      const jsonData = JSON.stringify(sceneData)
      
      // Create blob
      const blob = new Blob([jsonData], { type: 'application/json' })
      
      // Save to blob storage via API route
      const formData = new FormData()
      formData.append('file', blob, `drawing-${Date.now()}.json`)
      
      const response = await fetch('/api/save-drawing', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) throw new Error('Failed to save drawing')
      const result = await response.json()
      console.log('Drawing saved:', result.url)
      alert('Drawing saved successfully!')
    } catch (error) {
      console.error('Error saving drawing:', error)
      alert('Failed to save drawing')
    } finally {
      setIsSaving(false)
    }
  }, [excalidrawAPI])

  // Load drawing from blob storage
  const loadDrawing = useCallback(async () => {
    if (!excalidrawAPI) return

    try {
      // For demo purposes, we'll load from a sample URL
      // In production, you'd have a list of saved drawings
      const response = await fetch('/api/list-drawings')
      if (!response.ok) throw new Error('Failed to list drawings')
      const drawings = await response.json()
      if (Array.isArray(drawings) && drawings.length > 0) {
        const drawingResponse = await fetch(drawings[0].url)
        const drawingData = await drawingResponse.json()
        excalidrawAPI.updateScene(drawingData)
        alert('Drawing loaded successfully!')
      } else {
        alert('No saved drawings found')
      }
    } catch (error) {
      console.error('Error loading drawing:', error)
      alert('Failed to load drawing')
    }
  }, [excalidrawAPI])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Excalidraw with Vercel Blob</h1>
        <button onClick={saveDrawing} disabled={isSaving || !excalidrawAPI} style={{ padding: '8px 12px', background: '#3b82f6', color: '#fff', borderRadius: 6 }}> {isSaving ? 'Saving...' : 'Save Drawing'} </button>
        <button onClick={loadDrawing} disabled={!excalidrawAPI} style={{ padding: '8px 12px', background: '#10b981', color: '#fff', borderRadius: 6 }}> Load Drawing </button>
      </div>
      
      {/* Excalidraw Canvas */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          initialData={{ appState: { viewBackgroundColor: '#ffffff', theme: 'light' } }}
        />
      </div>
    </div>
  )
}
