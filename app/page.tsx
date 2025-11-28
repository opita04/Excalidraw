'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useCallback } from 'react'
import DrawingList from './components/DrawingList'

const Excalidraw = dynamic(
	async () => {
		const { Excalidraw } = await import('@excalidraw/excalidraw')
		return Excalidraw
	},
	{ ssr: false, loading: () => <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh'}}>Loading Excalidraw...</div> }
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
	const [currentDrawing, setCurrentDrawing] = useState<{ name: string; url: string } | null>(null)

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

	// Handle changes from Excalidraw to sync theme and detect cleared canvas
	const handleExcalidrawChange = useCallback((elements: any, appState: any) => {
		if (appState.theme && appState.theme !== theme) {
			// Update our theme state to match Excalidraw's theme
			setTheme(appState.theme)
			// Update document theme attribute
			document.documentElement.setAttribute('data-theme', appState.theme)
			// Save to localStorage
			if (isMounted) {
				localStorage.setItem('excalidraw-theme', appState.theme)
			}
		}

		// Clear current drawing if scene becomes empty (e.g., after Reset)
		// Use a callback to get the current value to avoid stale closure issues
		// Also add a small delay to handle potential race conditions
		if (Array.isArray(elements) && elements.length === 0) {
			setTimeout(() => {
				setCurrentDrawing(prevDrawing => {
					if (prevDrawing) {
						return null
					}
					return prevDrawing
				})
			}, 100) // Small delay to handle race conditions
		}
	}, [theme, isMounted])

	// Manual theme toggle function
	const toggleTheme = useCallback(() => {
		if (excalidrawAPI) {
			const newTheme = theme === 'light' ? 'dark' : 'light'
			try {
				const currentAppState = excalidrawAPI.getAppState()
				excalidrawAPI.updateScene({
					elements: excalidrawAPI.getSceneElements(),
					appState: {
						...currentAppState,
						theme: newTheme
					}
				})
				
				// Update our app state
				setTheme(newTheme)
				document.documentElement.setAttribute('data-theme', newTheme)
				if (isMounted) {
					localStorage.setItem('excalidraw-theme', newTheme)
				}
			} catch (error) {
				console.warn('Could not toggle theme:', error)
			}
		}
	}, [theme, excalidrawAPI, isMounted])

	useEffect(() => {
		// Set up periodic check for empty canvas when API is available
		if (excalidrawAPI) {
			const checkCanvasEmpty = () => {
				const elements = excalidrawAPI.getSceneElements()
				if (Array.isArray(elements) && elements.length === 0) {
					setCurrentDrawing(prevDrawing => {
						if (prevDrawing) {
							return null
						}
						return prevDrawing
					})
				}
			}
			
			// Check immediately and then periodically
			checkCanvasEmpty()
			const interval = setInterval(checkCanvasEmpty, 1000) // Check every second
			
			return () => clearInterval(interval)
		}
	}, [excalidrawAPI])

	const showSaveDrawingDialog = useCallback(() => {
		if (!excalidrawAPI) return
		// Pre-fill with current drawing name if one is loaded, otherwise empty
		setDrawingName(currentDrawing ? currentDrawing.name.replace('.excalidraw', '') : '')
		setSaveDialogError('')
		setShowSaveDialog(true)
	}, [excalidrawAPI, currentDrawing])

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
				// Preserve the current background color instead of forcing theme-based colors
				viewBackgroundColor: appState.viewBackgroundColor || '#ffffff',
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

			// If this is an update to an existing drawing, include the existing URL for the API to handle
			if (currentDrawing && currentDrawing.name === `${cleanName}.excalidraw`) {
				formData.append('existingUrl', currentDrawing.url)
			}

			const response = await fetch('/api/save-drawing', { method: 'POST', body: formData })
			if (!response.ok) throw new Error('Failed to save drawing')
			const result = await response.json()

			// Update current drawing info if this was a new save or name change
			if (!currentDrawing || currentDrawing.name !== `${cleanName}.excalidraw`) {
				setCurrentDrawing({ name: `${cleanName}.excalidraw`, url: result.url })
			}

			console.log('Drawing saved:', result.url)
			alert(`${currentDrawing ? 'Drawing updated' : 'Drawing saved'}: "${drawingName.trim()}" ${currentDrawing ? 'updated' : 'saved'} successfully!`)
		} catch (error) {
			console.error('Error saving drawing:', error)
			alert('Failed to save drawing')
		} finally {
			setIsSaving(false)
		}
	}, [excalidrawAPI, drawingName, theme, currentDrawing])

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
					collaborators: new Map()
				}
				
				excalidrawAPI.updateScene({
					elements: drawingData.elements || [],
					appState: loadAppState
				})
				
				// Set current drawing info
				setCurrentDrawing({ name: data[0].name, url: data[0].url })

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
				collaborators: new Map()
			}

			excalidrawAPI.updateScene({
				elements: drawingData.elements || [],
				appState: loadAppState
			})

			// Set current drawing info
			setCurrentDrawing({ name: drawing.name, url: drawing.url })

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
						initialData={{ 
							appState: { 
								theme: theme 
							} 
						}}
						theme={theme}
						onChange={handleExcalidrawChange}
					/>
				</div>
				
				{/* Show DrawingList when in list mode */}
				{viewMode === 'list' && (
					<div style={{
						height: '100%',
						width: '100%',
						background: 'var(--color-surface-lowest)',
						minHeight: '100vh'
					}}>
						<DrawingList
							theme={theme}
							onLoadDrawing={handleLoadDrawing}
							onDrawingDeleted={handleDrawingDeleted}
							onDrawingRenamed={handleDrawingRenamed}
						/>
					</div>
				)}
			</div>
			
			{/* Collapsible Bottom Navigation Bar */}
			<div style={{
				position: 'fixed',
				bottom: 0,
				left: 0,
				right: 0,
					background: 'var(--color-surface-lowest)',
					borderTop: '1px solid var(--color-border-outline)',
					boxShadow: '0px 100px 80px rgba(0, 0, 0, 0.07), 0px 41.7776px 33.4221px rgba(0, 0, 0, 0.0503198), 0px 22.3363px 17.869px rgba(0, 0, 0, 0.0417275), 0px 12.5216px 10.0172px rgba(0, 0, 0, 0.035), 0px 6.6501px 5.32008px rgba(0, 0, 0, 0.0282725), 0px 2.76726px 2.21381px rgba(0, 0, 0, 0.0196802)',
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
					background: 'var(--color-surface-lowest)',
					borderTop: '1px solid var(--color-border-outline)',
					borderLeft: '1px solid var(--color-border-outline)',
					borderRight: '1px solid var(--color-border-outline)',
					borderBottom: 'none',
					borderRadius: '8px 8px 0 0',
					padding: '8px 16px',
					cursor: 'pointer',
					boxShadow: '0px 15px 6px rgba(0, 0, 0, 0.01), 0px 8px 5px rgba(0, 0, 0, 0.05), 0px 4px 4px rgba(0, 0, 0, 0.09), 0px 1px 2px rgba(0, 0, 0, 0.1), 0px 0px 0px rgba(0, 0, 0, 0.1)'
				}} onClick={() => setIsNavCollapsed(!isNavCollapsed)}>
					<div style={{
						width: '20px',
						height: '2px',
						background: 'var(--color-gray-60)',
						margin: '2px 0',
						transition: 'transform 0.3s ease'
					}}></div>
					<div style={{
						width: '20px',
						height: '2px',
						background: 'var(--color-gray-60)',
						margin: '2px 0',
						transition: 'transform 0.3s ease'
					}}></div>
					<div style={{
						width: '20px',
						height: '2px',
						background: 'var(--color-gray-60)',
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
						color: 'var(--color-on-surface)',
						margin: 0
					}}>Excalidraw with Vercel Blob</h1>

					<button
						onClick={() => setViewMode(viewMode === 'canvas' ? 'list' : 'canvas')}
						style={{
							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center',
							padding: '0.5rem 0.75rem',
							backgroundColor: 'var(--color-surface-mid)',
							color: 'var(--color-primary)',
							border: `1px solid var(--color-primary)`,
							borderRadius: '0.5rem',
							cursor: 'pointer',
							transition: 'all 0.2s ease',
							fontSize: '0.75rem',
							fontWeight: '500',
							boxSizing: 'border-box',
							height: '2.25rem',
							boxShadow: '0px 0px 0.9310142993927002px 0px rgba(0, 0, 0, 0.17), 0px 0px 3.1270833015441895px 0px rgba(0, 0, 0, 0.08), 0px 7px 14px 0px rgba(0, 0, 0, 0.05)',
							textDecoration: 'none'
						}}
						onMouseEnter={(e) => {
							const target = e.target as HTMLButtonElement
							target.style.backgroundColor = 'var(--color-primary)'
							target.style.color = 'var(--color-surface-lowest)'
						}}
						onMouseLeave={(e) => {
							const target = e.target as HTMLButtonElement
							target.style.backgroundColor = 'var(--color-surface-mid)'
							target.style.color = 'var(--color-primary)'
						}}
					>
						{viewMode === 'canvas' ? '📁 My Drawings' : '🎨 Canvas'}
					</button>

					<button
						onClick={toggleTheme}
						style={{
							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center',
							padding: '0.5rem 0.75rem',
							backgroundColor: 'var(--color-surface-mid)',
							color: 'var(--color-primary)',
							border: `1px solid var(--color-primary)`,
							borderRadius: '0.5rem',
							cursor: 'pointer',
							transition: 'all 0.2s ease',
							fontSize: '0.75rem',
							fontWeight: '500',
							boxSizing: 'border-box',
							height: '2.25rem',
							boxShadow: '0px 0px 0.9310142993927002px 0px rgba(0, 0, 0, 0.17), 0px 0px 3.1270833015441895px 0px rgba(0, 0, 0, 0.08), 0px 7px 14px 0px rgba(0, 0, 0, 0.05)',
							textDecoration: 'none'
						}}
						onMouseEnter={(e) => {
							const target = e.target as HTMLButtonElement
							target.style.backgroundColor = 'var(--color-primary)'
							target.style.color = 'var(--color-surface-lowest)'
						}}
						onMouseLeave={(e) => {
							const target = e.target as HTMLButtonElement
							target.style.backgroundColor = 'var(--color-surface-mid)'
							target.style.color = 'var(--color-primary)'
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
								display: 'flex',
								justifyContent: 'center',
								alignItems: 'center',
								padding: '0.5rem 0.75rem',
								backgroundColor: 'var(--color-surface-mid)',
								color: 'var(--color-primary)',
								border: `1px solid var(--color-primary)`,
								borderRadius: '0.5rem',
								cursor: (isSaving || !excalidrawAPI) ? 'not-allowed' : 'pointer',
								opacity: (isSaving || !excalidrawAPI) ? 0.5 : 1,
								transition: 'all 0.2s ease',
								fontSize: '0.75rem',
								fontWeight: '500',
								boxSizing: 'border-box',
								height: '2.25rem',
								boxShadow: '0px 0px 0.9310142993927002px 0px rgba(0, 0, 0, 0.17), 0px 0px 3.1270833015441895px 0px rgba(0, 0, 0, 0.08), 0px 7px 14px 0px rgba(0, 0, 0, 0.05)',
								textDecoration: 'none'
							}}
							onMouseEnter={(e) => {
								const target = e.target as HTMLButtonElement
								if (!isSaving && excalidrawAPI) {
									target.style.backgroundColor = 'var(--color-primary)'
									target.style.color = 'var(--color-surface-lowest)'
								}
							}}
							onMouseLeave={(e) => {
								const target = e.target as HTMLButtonElement
								if (!isSaving && excalidrawAPI) {
									target.style.backgroundColor = 'var(--color-surface-mid)'
									target.style.color = 'var(--color-primary)'
								}
							}}
						>
							{isSaving ? 'Saving...' : (currentDrawing ? 'Update Drawing' : 'Save Drawing')}
						</button>
							<button
								onClick={loadDrawing}
								disabled={!excalidrawAPI}
								style={{
									display: 'flex',
									justifyContent: 'center',
									alignItems: 'center',
									padding: '0.5rem 0.75rem',
									backgroundColor: 'var(--color-surface-mid)',
									color: 'var(--color-primary)',
									border: `1px solid var(--color-primary)`,
									borderRadius: '0.5rem',
									cursor: !excalidrawAPI ? 'not-allowed' : 'pointer',
									opacity: !excalidrawAPI ? 0.5 : 1,
									transition: 'all 0.2s ease',
									fontSize: '0.75rem',
									fontWeight: '500',
									boxSizing: 'border-box',
									height: '2.25rem',
									boxShadow: '0px 0px 0.9310142993927002px 0px rgba(0, 0, 0, 0.17), 0px 0px 3.1270833015441895px 0px rgba(0, 0, 0, 0.08), 0px 7px 14px 0px rgba(0, 0, 0, 0.05)',
									textDecoration: 'none'
								}}
								onMouseEnter={(e) => {
									const target = e.target as HTMLButtonElement
									if (excalidrawAPI) {
										target.style.backgroundColor = 'var(--color-primary)'
										target.style.color = 'var(--color-surface-lowest)'
									}
								}}
								onMouseLeave={(e) => {
									const target = e.target as HTMLButtonElement
									if (excalidrawAPI) {
										target.style.backgroundColor = 'var(--color-surface-mid)'
										target.style.color = 'var(--color-primary)'
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
						background: 'var(--color-surface-lowest)',
						borderRadius: '8px',
						padding: '24px',
						boxShadow: '0px 100px 80px rgba(0, 0, 0, 0.07), 0px 41.7776px 33.4221px rgba(0, 0, 0, 0.0503198), 0px 22.3363px 17.869px rgba(0, 0, 0, 0.0417275), 0px 12.5216px 10.0172px rgba(0, 0, 0, 0.035), 0px 6.6501px 5.32008px rgba(0, 0, 0, 0.0282725), 0px 2.76726px 2.21381px rgba(0, 0, 0, 0.0196802)',
						minWidth: '400px',
						maxWidth: '500px'
					}}>
						<h3 style={{
							margin: '0 0 16px 0',
							color: 'var(--color-on-surface)',
							fontSize: '20px',
							fontWeight: '600'
						}}>
							{currentDrawing ? 'Update Drawing' : 'Name Your Drawing'}
						</h3>

						<div style={{ marginBottom: '16px' }}>
							<label style={{
								display: 'block',
								marginBottom: '8px',
								color: 'var(--color-on-surface)',
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
									border: `1px solid var(--color-border-outline)`,
									borderRadius: '6px',
									background: 'var(--color-surface-mid)',
									color: 'var(--color-on-surface)',
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
								background: 'var(--color-danger-background)',
								border: `1px solid var(--color-danger)`,
								borderRadius: '4px',
								color: 'var(--color-danger)',
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
									background: 'var(--color-surface-mid)',
									color: 'var(--color-on-surface)',
									border: `1px solid var(--color-border-outline)`,
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
									background: 'var(--color-primary)',
									color: 'var(--color-surface-lowest)',
									border: 'none',
									borderRadius: '6px',
									cursor: (!drawingName.trim() || isSaving) ? 'not-allowed' : 'pointer',
									fontSize: '14px',
									opacity: (!drawingName.trim() || isSaving) ? 0.5 : 1
								}}
							>
								{isSaving ? 'Saving...' : (currentDrawing ? 'Update Drawing' : 'Save Drawing')}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
