import { useState } from 'react'
import type { Group, Task } from '../api'
import { countDescendants, type Forest } from '../forest'
import { QuickAdd } from './QuickAdd'

type Props = {
  task: Task
  forest: Forest
  groups: Map<number, Group>
  dimmed?: boolean
  /** Nested successors, rendered under this row in show-all mode. */
  children?: React.ReactNode
  /** Show a "then …" preview of what follows (used in heads-only mode). */
  showNext?: boolean
  onToggle: (task: Task) => void
}

export function TaskRow({ task, forest, groups, dimmed, showNext, onToggle, children }: Props) {
  // While adding successors, each new task becomes the parent of the next one,
  // so typing "shave ⏎ shower ⏎ trim nails ⏎" builds a chain.
  const [chainParent, setChainParent] = useState<Task | null>(null)
  const next = forest.children.get(task.id) ?? []
  const deeper = countDescendants(forest, task.id) - next.length

  return (
    <li className={dimmed ? 'task dimmed' : 'task'}>
      <div className="task-main">
        <input
          type="checkbox"
          checked={task.completed_at !== null}
          onChange={() => onToggle(task)}
          aria-label={`Complete ${task.title}`}
        />
        <div className="task-body">
          <span className="task-title">{task.title}</span>
          <div className="task-meta">
            {task.due_date && <DueDate date={task.due_date} />}
            {task.group_ids.map((id) => {
              const g = groups.get(id)
              return (
                g && (
                  <span key={id} className="tag" style={{ '--chip': g.color } as React.CSSProperties}>
                    {g.name}
                  </span>
                )
              )
            })}
            {showNext && next.length > 0 && (
              <span className="next">
                then {next.map((t) => t.title).join(', ')}
                {deeper > 0 && ` +${deeper}`}
              </span>
            )}
          </div>
        </div>
        <button
          className="add-next"
          onClick={() => setChainParent(chainParent ? null : task)}
          aria-label={`Add a task after ${task.title}`}
          title="Add a task after this"
        >
          +
        </button>
      </div>
      {chainParent && (
        <QuickAdd
          parentId={chainParent.id}
          groupIds={task.group_ids}
          placeholder={`After “${chainParent.title}”…`}
          autoFocus
          onAdded={setChainParent}
          onCancel={() => setChainParent(null)}
        />
      )}
      {children}
    </li>
  )
}

/** Days from today (local time) until an ISO `YYYY-MM-DD` date; negative when overdue. */
function daysUntil(date: string): { due: Date; days: number } {
  const [y, m, d] = date.split('-').map(Number)
  const due = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return { due, days: Math.round((due.getTime() - today.getTime()) / 86_400_000) }
}

function DueDate({ date }: { date: string }) {
  const { due, days } = daysUntil(date)
  const label =
    days === 0
      ? 'Today'
      : days === 1
        ? 'Tomorrow'
        : due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return <span className={days < 0 ? 'due overdue' : days <= 1 ? 'due soon' : 'due'}>{label}</span>
}
