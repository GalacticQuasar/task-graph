import { useState } from 'react'
import { useCreateTask, type Task } from '../api'

type Props = {
  parentId?: number | null
  groupIds?: number[]
  placeholder: string
  initialTitle?: string
  autoFocus?: boolean
  onAdded?: (task: Task) => void
  onCancel?: () => void
}

export function QuickAdd({
  parentId = null,
  groupIds = [],
  placeholder,
  initialTitle = '',
  autoFocus,
  onAdded,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(initialTitle)
  const create = useCreateTask()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    create.mutate(
      { title: trimmed, parent_id: parentId, group_ids: groupIds },
      {
        onSuccess: (task) => {
          setTitle('')
          onAdded?.(task)
        },
      },
    )
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onCancel?.()}
        onBlur={() => !title.trim() && onCancel?.()}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        enterKeyHint="done"
      />
      <button type="submit" disabled={!title.trim() || create.isPending}>
        Add
      </button>
      {create.isError && <p className="error">Couldn't add: {create.error.message}</p>}
    </form>
  )
}
