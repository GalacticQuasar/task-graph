import { useEffect, useMemo, useState } from 'react'
import { useGroups, useSetDone, useTasks, type Group, type Task } from '../api'
import { TaskRow } from '../components/TaskRow'
import { buildForest, isActionable, type Forest } from '../forest'

type Props = {
  groupId: number | undefined
  showAll: boolean
}

export function Actionable({ groupId, showAll }: Props) {
  // Always fetch every open task (unfiltered) so we can tell heads from successors and
  // preview what comes next, even when a predecessor sits in a different group.
  const tasks = useTasks('all')
  const groups = useGroups()
  const setDone = useSetDone()
  const [lastDone, setLastDone] = useState<Task | null>(null)

  const forest = useMemo(() => buildForest(tasks.data ?? []), [tasks.data])
  const groupMap = useMemo(() => new Map((groups.data ?? []).map((g) => [g.id, g])), [groups.data])
  const inGroup = (t: Task) => groupId === undefined || t.group_ids.includes(groupId)

  useEffect(() => {
    if (!lastDone) return
    const timer = setTimeout(() => setLastDone(null), 5000)
    return () => clearTimeout(timer)
  }, [lastDone])

  function toggle(task: Task) {
    const done = task.completed_at === null
    setDone.mutate({ id: task.id, done }, { onSuccess: () => setLastDone(done ? task : null) })
  }

  if (tasks.isPending) return <p className="status">Loading…</p>
  if (tasks.isError) return <p className="status error">Couldn't reach the server: {tasks.error.message}</p>

  const visible = (tasks.data ?? []).filter(inGroup)
  const rowProps = { forest, groups: groupMap, onToggle: toggle }

  let body: React.ReactNode
  if (showAll) {
    // Roots of the displayed tree: tasks whose parent isn't shown (done, or outside the filter).
    const shown = new Set(visible.map((t) => t.id))
    const roots = visible.filter((t) => t.parent_id === null || !shown.has(t.parent_id))
    body = <TaskTree tasks={roots} shown={shown} {...rowProps} />
  } else {
    const heads = visible.filter((t) => isActionable(forest, t))
    body = (
      <ul className="tasks">
        {heads.map((t) => (
          <TaskRow key={t.id} task={t} showNext {...rowProps} />
        ))}
      </ul>
    )
  }

  return (
    <>
      {visible.length === 0 ? (
        <p className="status">{groupId === undefined ? 'Nothing to do. Add a task above.' : 'Nothing in this group.'}</p>
      ) : (
        body
      )}
      {lastDone && (
        <div className="toast" role="status">
          Completed “{lastDone.title}”
          <button
            onClick={() => {
              setDone.mutate({ id: lastDone.id, done: false })
              setLastDone(null)
            }}
          >
            Undo
          </button>
        </div>
      )}
    </>
  )
}

type TreeProps = {
  tasks: Task[]
  shown: Set<number>
  forest: Forest
  groups: Map<number, Group>
  onToggle: (task: Task) => void
}

function TaskTree({ tasks, shown, ...rowProps }: TreeProps) {
  return (
    <ul className="tasks">
      {tasks.map((t) => {
        const kids = (rowProps.forest.children.get(t.id) ?? []).filter((c) => shown.has(c.id))
        return (
          <TaskRow key={t.id} task={t} dimmed={!isActionable(rowProps.forest, t)} {...rowProps}>
            {kids.length > 0 && <TaskTree tasks={kids} shown={shown} {...rowProps} />}
          </TaskRow>
        )
      })}
    </ul>
  )
}
