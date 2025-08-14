'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useCallback } from 'react'

const Excalidraw = dynamic(
	async () => {
		const { Excalidraw } = await import('@excalidraw/excalidraw')
		return Excalidraw
	},
	{ ssr: false }
)

export default function Home() {
	const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null)
	const [isSaving, setIsSaving] = useState(false)
	const [isNavCollapsed, setIsNavCollapsed] = useState(false)

	useEffect(() => {
		// Basic diagnostics to confirm mount
		console.log('ExcalidrawAPI set?', Boolean(excalidrawAPI))
	}, [excalidrawAPI])

	const saveDrawing = useCallback(async () => {
		if (!excalidrawAPI) return
		try {
			setIsSaving(true)
			const sceneData = excalidrawAPI.getSceneData()
			const jsonData = JSON.stringify(sceneData)
			const blob = new Blob([jsonData], { type: 'application/json' })
			const formData = new FormData()
			formData.append('file', blob, `drawing-${Date.now()}.json`)
			const response = await fetch('/api/save-drawing', { method: 'POST', body: formData })
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

	const loadDrawing = useCallback(async () => {
		if (!excalidrawAPI) return
		try {
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
		<div style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
			{/* Excalidraw Canvas - takes full height */}
			<div style={{ flex: 1, minHeight: 0 }}>
				<Excalidraw
					excalidrawAPI={(api) => setExcalidrawAPI(api)}
					initialData={{ appState: { viewBackgroundColor: '#ffffff', theme: 'light' } }}
				/>
			</div>
			
			{/* Collapsible Bottom Navigation Bar */}
			<div style={{ 
				position: 'fixed', 
				bottom: 0, 
				left: 0, 
				right: 0, 
				background: '#fff', 
				borderTop: '1px solid #e5e7eb', 
				boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)',
				transition: 'transform 0.3s ease-in-out',
				transform: isNavCollapsed ? 'translateY(100%)' : 'translateY(0)',
				zIndex: 1000
			}}>
				{/* Toggle Button */}
				<div style={{ 
					position: 'absolute', 
					top: '-40px', 
					left: '50%', 
					transform: 'translateX(-50%)',
					background: '#fff',
					border: '1px solid #e5e7eb',
					borderBottom: 'none',
					borderRadius: '8px 8px 0 0',
					padding: '8px 16px',
					cursor: 'pointer',
					boxShadow: '0 -2px 4px rgba(0, 0, 0, 0.1)'
				}} onClick={() => setIsNavCollapsed(!isNavCollapsed)}>
					<div style={{ 
						width: '20px', 
						height: '2px', 
						background: '#6b7280',
						margin: '2px 0',
						transition: 'transform 0.3s ease'
					}}></div>
					<div style={{ 
						width: '20px', 
						height: '2px', 
						background: '#6b7280',
						margin: '2px 0',
						transition: 'transform 0.3s ease'
					}}></div>
					<div style={{ 
						width: '20px', 
						height: '2px', 
						background: '#6b7280',
						margin: '2px 0',
						transition: 'transform 0.3s ease'
					}}></div>
				</div>
				
				{/* Navigation Content */}
				<div style={{ 
					padding: '16px', 
					display: 'flex', 
					gap: '16px', 
					alignItems: 'center',
					justifyContent: 'center'
				}}>
					<h1 style={{ 
						fontSize: '18px', 
						fontWeight: '700', 
						color: '#111827',
						margin: 0
					}}>Excalidraw with Vercel Blob</h1>
					<button
						onClick={saveDrawing}
						disabled={isSaving || !excalidrawAPI}
						style={{ 
							padding: '8px 16px', 
							background: '#3b82f6', 
							color: '#fff', 
							border: 'none',
							borderRadius: '6px', 
							cursor: 'pointer',
							opacity: (isSaving || !excalidrawAPI) ? 0.5 : 1,
							transition: 'background-color 0.2s ease'
						}}
						onMouseEnter={(e) => {
							if (!isSaving && excalidrawAPI) {
								e.target.style.background = '#2563eb'
							}
						}}
						onMouseLeave={(e) => {
							if (!isSaving && excalidrawAPI) {
								e.target.style.background = '#3b82f6'
							}
						}}
					>
						{isSaving ? 'Saving...' : 'Save Drawing'}
					</button>
					<button
						onClick={loadDrawing}
						disabled={!excalidrawAPI}
						style={{ 
							padding: '8px 16px', 
							background: '#10b981', 
							color: '#fff', 
							border: 'none',
							borderRadius: '6px', 
							cursor: 'pointer',
							opacity: !excalidrawAPI ? 0.5 : 1,
							transition: 'background-color 0.2s ease'
						}}
						onMouseEnter={(e) => {
							if (excalidrawAPI) {
								e.target.style.background = '#059669'
							}
						}}
						onMouseLeave={(e) => {
							if (excalidrawAPI) {
								e.target.style.background = '#10b981'
							}
						}}
					>
						Load Drawing
					</button>
				</div>
			</div>
		</div>
	)
}
