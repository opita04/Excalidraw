'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useCallback } from 'react'
import DrawingList from './components/DrawingList'

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
	const [theme, setTheme] = useState<'light' | 'dark'>('light')
	const [viewMode, setViewMode] = useState<'canvas' | 'list'>('canvas')
	const [showSaveDialog, setShowSaveDialog] = useState(false)
	const [drawingName, setDrawingName] = useState('')
	const [saveDialogError, setSaveDialogError] = useState('')
	const [isMounted, setIsMounted] = useState(false)

	useEffect(() => {
		// Mark component as mounted to enable client-side features
		setIsMounted(true)
		
		// Only run on client side to avoid SSR hydration mismatch
		const savedTheme = localStorage.getItem('excalidraw-theme') as 'light' | 'dark' | null
		const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
		const initialTheme = savedTheme || systemTheme
		
		// Only update if different from current theme to avoid unnecessary re-renders
		if (initialTheme !== theme) {
			setTheme(initialTheme)
		}

		// Apply theme to document
		document.documentElement.setAttribute('data-theme', initialTheme)
	}, [])

	useEffect(() => {
		// Save theme to localStorage when it changes (client-side only)
		if (isMounted && typeof window !== 'undefined') {
			localStorage.setItem('excalidraw-theme', theme)
			document.documentElement.setAttribute('data-theme', theme)
		}
	}, [theme, isMounted])

	useEffect(() => {
		// Basic diagnostics to confirm mount
		console.log('ExcalidrawAPI set?', Boolean(excalidrawAPI))
	}, [excalidrawAPI])

	const showSaveDrawingDialog = useCallback(() => {
		if (!excalidrawAPI) return
		setDrawingName('')
		setSaveDialogError('')
		setShowSaveDialog(true)
	}, [excalidrawAPI])

	const validateDrawingName = (name: string): string | null => {
		if (!name.trim()) {
			return 'Drawing name cannot be empty'
		}
		if (name.trim().length < 2) {
			return 'Drawing name must be at least 2 characters long'
		}
		if (name.length > 50) {
			return 'Drawing name cannot exceed 50 characters'
		}
		// Check for invalid characters
		const invalidChars = /[<>:"/\\|?*\x00-\x1f]/g
		if (invalidChars.test(name)) {
			return 'Drawing name contains invalid characters'
		}
		return null
	}

	const saveDrawing = useCallback(async () => {
		const validationError = validateDrawingName(drawingName)
		if (validationError) {
			setSaveDialogError(validationError)
			return
		}

		try {
			setIsSaving(true)
			setShowSaveDialog(false)
			const elements = excalidrawAPI.getSceneElements()
			const appState = excalidrawAPI.getAppState()
			
			// Ensure theme is preserved in appState
			// Create scene data in the exact format Excalidraw expects for .excalidraw files
			// Clean the appState to ensure proper serialization
			const cleanAppState = {
				...appState,
				theme: theme,
				// Remove or fix problematic fields that don't serialize well
				collaborators: undefined, // Remove collaborators as it's a Map and doesn't serialize
			}
			
			// Remove undefined values
			Object.keys(cleanAppState).forEach(key => {
				if (cleanAppState[key] === undefined) {
					delete cleanAppState[key]
				}
			})
			
			const sceneData = {
				type: 'excalidraw',
				version: 2,
				source: 'https://excalidraw.com',
				elements: elements || [],
				appState: cleanAppState,
				files: {}
			}

			const jsonData = JSON.stringify(sceneData)
			
			const blob = new Blob([jsonData], { type: 'application/json' })
			const formData = new FormData()
			// Use the custom name instead of timestamp
			const cleanName = drawingName.trim().replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '-')
			formData.append('file', blob, `${cleanName}.excalidraw`)
			const response = await fetch('/api/save-drawing', { method: 'POST', body: formData })
			if (!response.ok) throw new Error('Failed to save drawing')
			const result = await response.json()
			console.log('Drawing saved:', result.url)
			alert(`Drawing "${drawingName.trim()}" saved successfully!`)
		} catch (error) {
			console.error('Error saving drawing:', error)
			alert('Failed to save drawing')
		} finally {
			setIsSaving(false)
		}
	}, [excalidrawAPI, drawingName, theme])

	const cancelSaveDialog = useCallback(() => {
		setShowSaveDialog(false)
		setDrawingName('')
		setSaveDialogError('')
	}, [])

	const loadDrawing = useCallback(async () => {
		if (!excalidrawAPI) return
		try {
			const response = await fetch('/api/list-drawings')

			const data = await response.json()

			if (!response.ok) {
				if (response.status === 503) {
					alert(`Storage not configured: ${data.message}\n\nPlease configure BLOB_READ_WRITE_TOKEN in your environment variables.`)
					return
				}
				throw new Error(`HTTP ${response.status}: ${data.error || 'Failed to list drawings'}`)
			}

			if (Array.isArray(data) && data.length > 0) {
				// Use the new load-drawing API instead of fetching blob URL directly
				const drawingResponse = await fetch(`/api/load-drawing?url=${encodeURIComponent(data[0].url)}`)
				if (!drawingResponse.ok) {
					const errorData = await drawingResponse.json().catch(() => ({}))
					throw new Error(`Failed to load drawing: ${errorData.error || `HTTP ${drawingResponse.status}`}`)
				}

				const drawingData = await drawingResponse.json()

				// Restore theme from saved drawing or use current theme
				const savedTheme = drawingData.appState?.theme || theme
				setTheme(savedTheme)

				// Ensure appState is properly formatted for Excalidraw
				const loadAppState = {
					...drawingData.appState,
					theme: savedTheme,
					collaborators: new Map() // Recreate collaborators as Map
				}
				
				excalidrawAPI.updateScene({
					elements: drawingData.elements || [],
					appState: loadAppState
				})
				
				// Small delay to ensure the scene is updated, then fit to view
				setTimeout(() => {
					try {
						excalidrawAPI.scrollToContent(drawingData.elements || [], { fitToContent: true })
					} catch (zoomError) {
						console.warn('Could not zoom to fit content:', zoomError)
					}
				}, 100)
				
				alert('Drawing loaded successfully!')
			} else {
				console.log('No drawings found in response')
				alert('No saved drawings found. Try saving a drawing first.')
			}
		} catch (error) {
			console.error('Error loading drawing:', error)
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
			alert(`Failed to load drawing: ${errorMessage}`)
		}
	}, [excalidrawAPI])

	const handleLoadDrawing = useCallback(async (drawing: { url: string; name: string; uploadedAt: string }) => {
		if (!excalidrawAPI) {
			alert('Canvas not ready. Please wait a moment and try again.')
			return
		}

		try {
			// Use the new load-drawing API instead of fetching blob URL directly
			const drawingResponse = await fetch(`/api/load-drawing?url=${encodeURIComponent(drawing.url)}`)
			
			if (!drawingResponse.ok) {
				const errorData = await drawingResponse.json().catch(() => ({}))
				throw new Error(`Failed to load drawing: ${errorData.error || `HTTP ${drawingResponse.status}`}`)
			}

			const drawingData = await drawingResponse.json()

			// Restore theme from saved drawing or use current theme
			const savedTheme = drawingData.appState?.theme || theme
			setTheme(savedTheme)

			// Ensure appState is properly formatted for Excalidraw
			const loadAppState = {
				...drawingData.appState,
				theme: savedTheme,
				collaborators: new Map() // Recreate collaborators as Map
			}

			excalidrawAPI.updateScene({
				elements: drawingData.elements || [],
				appState: loadAppState
			})

			// Switch to canvas view to show the loaded drawing
			setViewMode('canvas')

			// Small delay to ensure the scene is updated, then fit to view
			setTimeout(() => {
				try {
					excalidrawAPI.scrollToContent(drawingData.elements || [], { fitToContent: true })
				} catch (zoomError) {
					console.warn('Could not zoom to fit content:', zoomError)
				}
			}, 100)
			
			alert(`Drawing "${drawing.name.replace('.excalidraw', '')}" loaded successfully!`)
		} catch (error) {
			console.error('Error loading drawing:', error)
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
			alert(`Failed to load drawing: ${errorMessage}`)
		}
	}, [excalidrawAPI, theme])

	const handleDrawingDeleted = useCallback(() => {
		// Refresh the list if needed
	}, [])

	const handleDrawingRenamed = useCallback(() => {
		// Refresh the list if needed
	}, [])

	return (
		<div style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
			{/* Main Content Area */}
			<div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
				{/* Always render Excalidraw but hide it when showing list */}
				<div style={{ 
					display: viewMode === 'canvas' ? 'block' : 'none',
					height: '100%',
					width: '100%'
				}}>
					<Excalidraw
						excalidrawAPI={(api) => setExcalidrawAPI(api)}
						initialData={{ appState: { viewBackgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', theme: theme } }}
					/>
				</div>
				
				{/* Show DrawingList when in list mode */}
				{viewMode === 'list' && (
					<DrawingList
						theme={theme}
						onLoadDrawing={handleLoadDrawing}
						onDrawingDeleted={handleDrawingDeleted}
						onDrawingRenamed={handleDrawingRenamed}
					/>
				)}
			</div>
			
			{/* Collapsible Bottom Navigation Bar */}
			<div style={{
				position: 'fixed',
				bottom: 0,
				left: 0,
				right: 0,
				background: theme === 'dark' ? '#1f2937' : '#fff',
				borderTop: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
				boxShadow: theme === 'dark' ? '0 -4px 6px -1px rgba(0, 0, 0, 0.3)' : '0 -4px 6px -1px rgba(0, 0, 0, 0.1)',
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
					background: theme === 'dark' ? '#1f2937' : '#fff',
					border: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
					borderBottom: 'none',
					borderRadius: '8px 8px 0 0',
					padding: '8px 16px',
					cursor: 'pointer',
					boxShadow: theme === 'dark' ? '0 -2px 4px rgba(0, 0, 0, 0.3)' : '0 -2px 4px rgba(0, 0, 0, 0.1)'
				}} onClick={() => setIsNavCollapsed(!isNavCollapsed)}>
					<div style={{
						width: '20px',
						height: '2px',
						background: theme === 'dark' ? '#9ca3af' : '#6b7280',
						margin: '2px 0',
						transition: 'transform 0.3s ease'
					}}></div>
					<div style={{
						width: '20px',
						height: '2px',
						background: theme === 'dark' ? '#9ca3af' : '#6b7280',
						margin: '2px 0',
						transition: 'transform 0.3s ease'
					}}></div>
					<div style={{
						width: '20px',
						height: '2px',
						background: theme === 'dark' ? '#9ca3af' : '#6b7280',
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
					justifyContent: 'center',
					flexWrap: 'wrap'
				}}>
					<h1 style={{
						fontSize: '18px',
						fontWeight: '700',
						color: theme === 'dark' ? '#f9fafb' : '#111827',
						margin: 0
					}}>Excalidraw with Vercel Blob</h1>

					<button
						onClick={() => setViewMode(viewMode === 'canvas' ? 'list' : 'canvas')}
						style={{
							padding: '8px 16px',
							background: viewMode === 'canvas' ? '#3b82f6' : '#10b981',
							color: '#fff',
							border: 'none',
							borderRadius: '6px',
							cursor: 'pointer',
							transition: 'background-color 0.2s ease',
							fontWeight: '500'
						}}
						onMouseEnter={(e) => {
							const target = e.target as HTMLButtonElement
							target.style.background = viewMode === 'canvas' ? '#2563eb' : '#059669'
						}}
						onMouseLeave={(e) => {
							const target = e.target as HTMLButtonElement
							target.style.background = viewMode === 'canvas' ? '#3b82f6' : '#10b981'
						}}
					>
						{viewMode === 'canvas' ? '📁 My Drawings' : '🎨 Canvas'}
					</button>

					<button
						onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
						style={{
							padding: '8px 16px',
							background: theme === 'dark' ? '#374151' : '#f3f4f6',
							color: theme === 'dark' ? '#f9fafb' : '#374151',
							border: `1px solid ${theme === 'dark' ? '#4b5563' : '#d1d5db'}`,
							borderRadius: '6px',
							cursor: 'pointer',
							transition: 'background-color 0.2s ease'
						}}
						onMouseEnter={(e) => {
							const target = e.target as HTMLButtonElement
							target.style.background = theme === 'dark' ? '#4b5563' : '#e5e7eb'
						}}
						onMouseLeave={(e) => {
							const target = e.target as HTMLButtonElement
							target.style.background = theme === 'dark' ? '#374151' : '#f3f4f6'
						}}
					>
						{theme === 'light' ? '🌙 Dark' : '☀️ Light'}
					</button>
					{viewMode === 'canvas' && (
						<>
												<button
						onClick={showSaveDrawingDialog}
						disabled={isSaving || !excalidrawAPI}
						style={{
							padding: '8px 16px',
							background: theme === 'dark' ? '#3b82f6' : '#3b82f6',
							color: '#fff',
							border: 'none',
							borderRadius: '6px',
							cursor: 'pointer',
							opacity: (isSaving || !excalidrawAPI) ? 0.5 : 1,
							transition: 'background-color 0.2s ease'
						}}
						onMouseEnter={(e) => {
							const target = e.target as HTMLButtonElement
							if (!isSaving && excalidrawAPI) {
								target.style.background = theme === 'dark' ? '#1e40af' : '#2563eb'
							}
						}}
						onMouseLeave={(e) => {
							const target = e.target as HTMLButtonElement
							if (!isSaving && excalidrawAPI) {
								target.style.background = '#3b82f6'
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
									background: theme === 'dark' ? '#059669' : '#10b981',
									color: '#fff',
									border: 'none',
									borderRadius: '6px',
									cursor: 'pointer',
									opacity: !excalidrawAPI ? 0.5 : 1,
									transition: 'background-color 0.2s ease'
								}}
								onMouseEnter={(e) => {
									const target = e.target as HTMLButtonElement
									if (excalidrawAPI) {
										target.style.background = theme === 'dark' ? '#047857' : '#059669'
									}
								}}
								onMouseLeave={(e) => {
									const target = e.target as HTMLButtonElement
									if (excalidrawAPI) {
										target.style.background = theme === 'dark' ? '#059669' : '#10b981'
									}
								}}
							>
								Load Drawing
							</button>
						</>
					)}
				</div>
			</div>

			{/* Save Drawing Dialog */}
			{showSaveDialog && (
				<div style={{
					position: 'fixed',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: 'rgba(0, 0, 0, 0.5)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 2000
				}}>
					<div style={{
						background: theme === 'dark' ? '#1f2937' : '#ffffff',
						borderRadius: '8px',
						padding: '24px',
						boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
						minWidth: '400px',
						maxWidth: '500px'
					}}>
						<h3 style={{
							margin: '0 0 16px 0',
							color: theme === 'dark' ? '#f9fafb' : '#111827',
							fontSize: '20px',
							fontWeight: '600'
						}}>
							Name Your Drawing
						</h3>

						<div style={{ marginBottom: '16px' }}>
							<label style={{
								display: 'block',
								marginBottom: '8px',
								color: theme === 'dark' ? '#f9fafb' : '#374151',
								fontSize: '14px',
								fontWeight: '500'
							}}>
								Drawing Name:
							</label>
							<input
								type="text"
								value={drawingName}
								onChange={(e) => setDrawingName(e.target.value)}
								placeholder="Enter a name for your drawing..."
								autoFocus
								style={{
									width: '100%',
									padding: '12px',
									border: `1px solid ${theme === 'dark' ? '#4b5563' : '#d1d5db'}`,
									borderRadius: '6px',
									background: theme === 'dark' ? '#374151' : '#ffffff',
									color: theme === 'dark' ? '#f9fafb' : '#111827',
									fontSize: '14px',
									boxSizing: 'border-box'
								}}
								onKeyDown={(e) => {
									if (e.key === 'Enter') {
										saveDrawing()
									} else if (e.key === 'Escape') {
										cancelSaveDialog()
									}
								}}
							/>
						</div>

						{saveDialogError && (
							<div style={{
								marginBottom: '16px',
								padding: '8px 12px',
								background: '#fef2f2',
								border: '1px solid #fecaca',
								borderRadius: '4px',
								color: '#dc2626',
								fontSize: '14px'
							}}>
								{saveDialogError}
							</div>
						)}

						<div style={{
							display: 'flex',
							gap: '12px',
							justifyContent: 'flex-end'
						}}>
							<button
								onClick={cancelSaveDialog}
								style={{
									padding: '8px 16px',
									background: theme === 'dark' ? '#374151' : '#f3f4f6',
									color: theme === 'dark' ? '#f9fafb' : '#374151',
									border: `1px solid ${theme === 'dark' ? '#4b5563' : '#d1d5db'}`,
									borderRadius: '6px',
									cursor: 'pointer',
									fontSize: '14px'
								}}
							>
								Cancel
							</button>
							<button
								onClick={saveDrawing}
								disabled={!drawingName.trim() || isSaving}
								style={{
									padding: '8px 16px',
									background: '#3b82f6',
									color: '#fff',
									border: 'none',
									borderRadius: '6px',
									cursor: (!drawingName.trim() || isSaving) ? 'not-allowed' : 'pointer',
									fontSize: '14px',
									opacity: (!drawingName.trim() || isSaving) ? 0.5 : 1
								}}
							>
								{isSaving ? 'Saving...' : 'Save Drawing'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
