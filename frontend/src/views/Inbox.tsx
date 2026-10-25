import { useSetDone, useTasks, useUpdateTask, type Task } from '../api'
import { TaskRow } from '../components/TaskRow'
import { useForest } from '../useForest'

/** Captured tasks with no group and no predecessor, waiting to be sorted. */
export function Inbox() {
  const inbox = useTasks('inbox')
  const { forest, groupMap } = useForest()
  const setDone = useSetDone()
  const update = useUpdateTask()

  if (inbox.isPending) return <p className="status">Loading…</p>
  if (inbox.isError) return <p className="status error">Couldn't reach the server: {inbox.error.message}</p>
  if (inbox.data.length === 0) return <p className="status">Inbox zero. Tasks you capture land here.</p>

  const toggle = (task: Task) => setDone.mutate({ id: task.id, done: task.completed_at === null })

  return (
    <>
      <p className="hint">Tap a group to file a task, or tap the task to set what it comes after.</p>
      <ul className="tasks">
        {inbox.data.map((t) => (
          <TaskRow key={t.id} task={t} forest={forest} groups={groupMap} showNext onToggle={toggle}>
            {groupMap.size > 0 && (
              <div className="chips triage" aria-label={`File ${t.title} into a group`}>
                {[...groupMap.values()].map((g) => (
                  <button
                    key={g.id}
                    className="chip"
                    style={{ '--chip': g.color } as React.CSSProperties}
                    onClick={() => update.mutate({ id: t.id, group_ids: [g.id] })}
                  >
                    <span className="dot" />
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </TaskRow>
        ))}
      </ul>
    </>
  )
}
