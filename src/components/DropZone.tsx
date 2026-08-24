import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'

// A file dropped outside any zone must not make the browser navigate away
// from the app (default drop behavior opens the file).
window.addEventListener('dragover', (e) => e.preventDefault())
window.addEventListener('drop', (e) => e.preventDefault())

/**
 * Drag-and-drop file target wrapping an editor area. While a file drag
 * hovers, a dashed overlay with `hint` appears; dropping hands all files
 * matching `kind` (MIME prefix, e.g. image/ or audio/) to `onFiles`.
 *
 * Zones may nest (an item editor inside the backlog list): dragover/drop
 * stop propagating, so only the innermost zone under the cursor reacts.
 * The hover highlight is driven by dragover with a short decay timer —
 * once the inner zone swallows the events, the outer highlight fades.
 */
export function DropZone({
  kind,
  hint,
  onFiles,
  children,
}: {
  kind: 'image' | 'audio'
  hint: string
  onFiles: (files: File[]) => void
  children: ReactNode
}) {
  const [over, setOver] = useState(false)
  const decay = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (decay.current) clearTimeout(decay.current)
    },
    [],
  )

  const dragsFiles = (e: DragEvent) => Array.from(e.dataTransfer?.items ?? []).some((i) => i.kind === 'file')

  return (
    <div
      className={`drop-zone${over ? ' over' : ''}`}
      data-hint={hint}
      onDragOver={(e) => {
        if (!dragsFiles(e)) return
        e.preventDefault()
        e.stopPropagation()
        setOver(true)
        if (decay.current) clearTimeout(decay.current)
        decay.current = setTimeout(() => setOver(false), 400)
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (decay.current) clearTimeout(decay.current)
        setOver(false)
        const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith(`${kind}/`))
        if (files.length > 0) onFiles(files)
      }}
    >
      {children}
    </div>
  )
}
