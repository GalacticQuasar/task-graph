import { useState } from 'react'
import { useCreateGroup, useGroups } from '../api'

const PALETTE = ['#4f6bed', '#e0703a', '#2f9e6b', '#c2447a', '#8a5cd6', '#b8901c', '#2b95b8']

type Props = {
  selected: number | undefined
  onSelect: (groupId: number | undefined) => void
}

export function GroupChips({ selected, onSelect }: Props) {
  const groups = useGroups()
  const create = useCreateGroup()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const color = PALETTE[(groups.data?.length ?? 0) % PALETTE.length]
    create.mutate(
      { name: trimmed, color },
      {
        onSuccess: (group) => {
          setName('')
          setAdding(false)
          onSelect(group.id)
        },
      },
    )
  }

  return (
    <div className="chips" role="toolbar" aria-label="Filter by group">
      <button className="chip" aria-pressed={selected === undefined} onClick={() => onSelect(undefined)}>
        All
      </button>
      {groups.data?.map((g) => (
        <button
          key={g.id}
          className="chip"
          aria-pressed={selected === g.id}
          style={{ '--chip': g.color } as React.CSSProperties}
          onClick={() => onSelect(selected === g.id ? undefined : g.id)}
        >
          <span className="dot" />
          {g.name}
        </button>
      ))}
      {adding ? (
        <form className="chip-form" onSubmit={submit}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
            onBlur={() => !name.trim() && setAdding(false)}
            placeholder="Group name"
            aria-label="New group name"
            autoFocus
          />
          {create.isError && <span className="error">{create.error.message}</span>}
        </form>
      ) : (
        <button className="chip chip-add" onClick={() => setAdding(true)} aria-label="New group">
          + group
        </button>
      )}
    </div>
  )
}
