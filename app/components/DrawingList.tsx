'use client'

import { useState, useEffect } from 'react'

interface Drawing {
  url: string
  name: string
  uploadedAt: string
}

interface DrawingListProps {
  theme: 'light' | 'dark'
  onLoadDrawing: (drawing: Drawing) => void
  onDrawingDeleted: () => void
  onDrawingRenamed: () => void
}

export default function DrawingList({ theme, onLoadDrawing, onDrawingDeleted, onDrawingRenamed }: DrawingListProps) {
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [loading, setLoading] = useState(true)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadDrawings()
  }, [])

  const loadDrawings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/list-drawings')
      if (!response.ok) {
        if (response.status === 503) {
          const data = await response.json()
          alert(`Storage not configured: ${data.message}\n\nPlease configure BLOB_READ_WRITE_TOKEN in your environment variables.`)
          return
        }
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      setDrawings(data)
    } catch (error) {
      console.error('Error loading drawings:', error)
      alert('Failed to load drawings')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (drawing: Drawing) => {
    if (!confirm(`Are you sure you want to delete "${drawing.name}"?`)) {
      return
    }

    try {
      setDeletingId(drawing.url)
      const response = await fetch(`/api/delete-drawing?url=${encodeURIComponent(drawing.url)}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      alert('Drawing deleted successfully!')
      onDrawingDeleted()
      await loadDrawings()
    } catch (error) {
      console.error('Error deleting drawing:', error)
      alert('Failed to delete drawing')
    } finally {
      setDeletingId(null)
    }
  }

  const handleRename = async (drawing: Drawing) => {
    if (!newName.trim()) {
      alert('Please enter a name')
      return
    }

    try {
      const response = await fetch(`/api/rename-drawing?url=${encodeURIComponent(drawing.url)}&name=${encodeURIComponent(newName.trim())}`, {
        method: 'PATCH'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      alert('Drawing renamed successfully!')
      setRenamingId(null)
      setNewName('')
      onDrawingRenamed()
      await loadDrawings()
    } catch (error) {
      console.error('Error renaming drawing:', error)
      alert('Failed to rename drawing')
    }
  }

  const startRename = (drawing: Drawing) => {
    setRenamingId(drawing.url)
    setNewName(drawing.name.replace('.excalidraw', ''))
  }

  const cancelRename = () => {
    setRenamingId(null)
    setNewName('')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '50vh',
        color: 'var(--color-on-surface)'
      }}>
        Loading drawings...
      </div>
    )
  }

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <h2 style={{
        color: 'var(--color-on-surface)',
        marginBottom: '20px',
        fontSize: '24px',
        fontWeight: 'bold'
      }}>
        Your Drawings ({drawings.length})
      </h2>

      {drawings.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: 'var(--color-gray-50)',
          background: 'var(--color-surface-mid)',
          borderRadius: '8px',
          border: `1px solid var(--color-border-outline)`
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎨</div>
          <div>No drawings found</div>
          <div style={{ fontSize: '14px', marginTop: '8px' }}>
            Create and save some drawings to see them here
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px'
        }}>
          {drawings.map((drawing) => (
            <div key={drawing.url} style={{
              background: 'var(--color-surface-lowest)',
              border: `1px solid var(--color-border-outline)`,
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0px 0px 0.9310142993927002px 0px rgba(0, 0, 0, 0.17), 0px 0px 3.1270833015441895px 0px rgba(0, 0, 0, 0.08), 0px 7px 14px 0px rgba(0, 0, 0, 0.05)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}>
              {/* Drawing Preview Placeholder */}
              <div style={{
                height: '150px',
                background: 'var(--color-surface-mid)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-gray-50)',
                fontSize: '14px'
              }}>
                🎨 Drawing Preview
              </div>

              {/* Drawing Info */}
              <div style={{ padding: '16px' }}>
                {renamingId === drawing.url ? (
                  <div style={{ marginBottom: '12px' }}>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Enter new name"
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: `1px solid var(--color-border-outline)`,
                        borderRadius: '4px',
                        background: 'var(--color-surface-mid)',
                        color: 'var(--color-on-surface)',
                        marginBottom: '8px'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleRename(drawing)}
                        style={{
                          padding: '6px 12px',
                          background: 'var(--color-primary)',
                          color: 'var(--color-surface-lowest)',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelRename}
                        style={{
                          padding: '6px 12px',
                          background: 'var(--color-surface-mid)',
                          color: 'var(--color-on-surface)',
                          border: `1px solid var(--color-border-outline)`,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 style={{
                      color: 'var(--color-on-surface)',
                      fontSize: '16px',
                      fontWeight: '600',
                      margin: '0 0 8px 0',
                      wordBreak: 'break-word'
                    }}>
                      {drawing.name.replace('.excalidraw', '').replace(/-/g, ' ')}
                    </h3>
                    <p style={{
                      color: 'var(--color-gray-60)',
                      fontSize: '12px',
                      margin: '0 0 12px 0'
                    }}>
                      Created: {formatDate(drawing.uploadedAt)}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => onLoadDrawing(drawing)}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--color-primary)',
                      color: 'var(--color-surface-lowest)',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      flex: 1,
                      minWidth: '80px'
                    }}
                  >
                    Load
                  </button>

                  {renamingId !== drawing.url && (
                    <button
                      onClick={() => startRename(drawing)}
                      style={{
                        padding: '8px 16px',
                        background: 'var(--color-surface-mid)',
                        color: 'var(--color-on-surface)',
                        border: `1px solid var(--color-border-outline)`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      Rename
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(drawing)}
                    disabled={deletingId === drawing.url}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--color-danger)',
                      color: 'var(--color-surface-lowest)',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: deletingId === drawing.url ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      opacity: deletingId === drawing.url ? 0.5 : 1
                    }}
                  >
                    {deletingId === drawing.url ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
