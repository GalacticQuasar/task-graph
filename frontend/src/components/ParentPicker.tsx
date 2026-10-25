import { useMemo, useState } from 'react'
import { useTask, useTasks } from '../api'
import { buildForest, selfAndDescendants } from '../forest'
import { fuzzyFilter } from '../fuzzy'

type Props = {
  taskId: number
  value: number | null
  onChange: (parentId: number | null) => void
}

/** Choose which task this one comes after, by fuzzy-searching open tasks. */
export function ParentPicker({ taskId, value, onChange }: Props) {
  const all = useTasks('all')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)

  const candidates = useMemo(() => {
    const open = all.data ?? []
    // Our own descendants can't become our parent (the server rejects cycles too).
    const excluded = selfAndDescendants(buildForest(open), taskId)
    return open.filter((t) => !excluded.has(t.id))
  }, [all.data, taskId])
  const matches = fuzzyFilter(query, candidates, (t) => t.title)

  if (!searching) {
    return (
      <div className="parent-value">
        {value === null ? (
          <span className="muted">Nothing — starts a sequence</span>
        ) : (
          <span>
            After <ParentTitle id={value} />
          </span>
        )}
        <button type="button" className="link" onClick={() => setSearching(true)}>
          {value === null ? 'Set…' : 'Change'}
        </button>
        {value !== null && (
          <button type="button" className="link" onClick={() => onChange(null)}>
            Detach
          </button>
        )}
      </div>
    )
  }

  function pick(id: number) {
    onChange(id)
    setQuery('')
    setSearching(false)
  }

  return (
    <div className="parent-search">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault() // keep the dialog open
            setSearching(false)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (matches[0]) pick(matches[0].id)
          }
        }}
        placeholder="Search tasks…"
        aria-label="Search for the task this comes after"
        autoFocus
      />
      <ul className="parent-results" role="listbox">
        {matches.map((t) => (
          <li key={t.id}>
            <button type="button" role="option" aria-selected={t.id === value} onClick={() => pick(t.id)}>
              {t.title}
            </button>
          </li>
        ))}
        {matches.length === 0 && <li className="muted">No matching open tasks</li>}
      </ul>
    </div>
  )
}

function ParentTitle({ id }: { id: number }) {
  const parent = useTask(id)
  if (!parent.data) return <strong>…</strong>
  return (
    <strong>
      {parent.data.title}
      {parent.data.completed_at && <span className="muted"> (done)</span>}
    </strong>
  )
}
