import { useEffect, useRef, useState } from 'react'
import { useDeleteTask, useGroups, useTask, useUpdateTask, type Task, type TaskUpdate } from '../api'
import { ParentPicker } from './ParentPicker'

type Props = {
  taskId: number
  onClose: () => void
}

/** Modal sheet for editing one task. */
export function TaskEditor({ taskId, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const task = useTask(taskId)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="sheet"
      onClose={onClose}
      // A click on the dialog element itself (not its contents) is a backdrop click.
      onClick={(e) => e.target === ref.current && ref.current.close()}
      aria-label="Edit task"
    >
      {task.data ? (
        // Keyed so the draft re-initialises if a different task is opened.
        <EditorForm key={task.data.id} task={task.data} close={() => ref.current?.close()} />
      ) : (
        <p className="status">{task.isError ? task.error.message : 'Loading…'}</p>
      )}
    </dialog>
  )
}

function EditorForm({ task, close }: { task: Task; close: () => void }) {
  const groups = useGroups()
  const update = useUpdateTask()
  const remove = useDeleteTask()
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [groupIds, setGroupIds] = useState(task.group_ids)
  const [parentId, setParentId] = useState(task.parent_id)

  function save(e: React.FormEvent) {
    e.preventDefault()
    const changes: TaskUpdate = {}
    if (title.trim() && title.trim() !== task.title) changes.title = title.trim()
    if (notes !== task.notes) changes.notes = notes
    if ((dueDate || null) !== task.due_date) changes.due_date = dueDate || null
    if (parentId !== task.parent_id) changes.parent_id = parentId
    if ([...groupIds].sort((a, b) => a - b).join() !== task.group_ids.join()) changes.group_ids = groupIds
    if (Object.keys(changes).length === 0) return close()
    update.mutate({ id: task.id, ...changes }, { onSuccess: close })
  }

  function toggleGroup(id: number) {
    setGroupIds((ids) => (ids.includes(id) ? ids.filter((g) => g !== id) : [...ids, id]))
  }

  function del() {
    if (confirm(`Delete “${task.title}”? Tasks after it will move up to take its place.`)) {
      remove.mutate(task.id, { onSuccess: close })
    }
  }

  const error = update.error ?? remove.error

  return (
    <form className="editor" onSubmit={save}>
      <input
        className="editor-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Title"
        required
      />

      <div className="field">
        <span>Comes after</span>
        <ParentPicker taskId={task.id} value={parentId} onChange={setParentId} />
      </div>

      <div className="field">
        <span>Groups</span>
        <div className="chips wrap">
          {groups.data?.map((g) => (
            <button
              key={g.id}
              type="button"
              className="chip"
              aria-pressed={groupIds.includes(g.id)}
              style={{ '--chip': g.color } as React.CSSProperties}
              onClick={() => toggleGroup(g.id)}
            >
              <span className="dot" />
              {g.name}
            </button>
          ))}
          {groups.data?.length === 0 && <span className="muted">No groups yet</span>}
        </div>
      </div>

      <label className="field">
        <span>Due</span>
        <div className="due-row">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          {dueDate && (
            <button type="button" className="link" onClick={() => setDueDate('')}>
              Clear
            </button>
          )}
        </div>
      </label>

      <label className="field">
        <span>Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </label>

      {error && <p className="error">{error.message}</p>}

      <div className="editor-actions">
        <button type="button" className="danger" onClick={del} disabled={remove.isPending}>
          Delete
        </button>
        <span className="spacer" />
        <button type="button" className="secondary" onClick={close}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={update.isPending}>
          Save
        </button>
      </div>
    </form>
  )
}
