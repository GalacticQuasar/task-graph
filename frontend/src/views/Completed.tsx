import { useGroups, useSetDone, useTasks, type Task } from '../api'
import { useOpenTask } from '../openTask'

/** Finished tasks, newest first, grouped by the local day they were completed. */
export function Completed() {
  const done = useTasks('completed')
  const groups = useGroups()
  const setDone = useSetDone()
  const openTask = useOpenTask()

  if (done.isPending) return <p className="status">Loading…</p>
  if (done.isError) return <p className="status error">Couldn't reach the server: {done.error.message}</p>
  if (done.data.length === 0) return <p className="status">Nothing completed yet.</p>

  const groupMap = new Map((groups.data ?? []).map((g) => [g.id, g]))

  return (
    <>
      {byDay(done.data).map(([day, tasks]) => (
        <section key={day} className="day">
          <h2>{dayLabel(day)}</h2>
          <ul className="tasks">
            {tasks.map((t) => (
              <li key={t.id} className="task done">
                <div className="task-main">
                  <input
                    type="checkbox"
                    checked
                    onChange={() => setDone.mutate({ id: t.id, done: false })}
                    aria-label={`Reopen ${t.title}`}
                  />
                  <button className="task-body" onClick={() => openTask(t.id)}>
                    <span className="task-title">{t.title}</span>
                    <span className="task-meta">
                      <span>{new Date(t.completed_at!).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                      {t.group_ids.map((id) => {
                        const g = groupMap.get(id)
                        return (
                          g && (
                            <span key={id} className="tag" style={{ '--chip': g.color } as React.CSSProperties}>
                              {g.name}
                            </span>
                          )
                        )
                      })}
                    </span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

/** Local calendar day as YYYY-MM-DD. */
function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function byDay(tasks: Task[]): [string, Task[]][] {
  const days = new Map<string, Task[]>()
  for (const t of tasks) {
    const day = localDay(new Date(t.completed_at!))
    days.set(day, [...(days.get(day) ?? []), t])
  }
  return [...days]
}

function dayLabel(day: string): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (day === localDay(today)) return 'Today'
  if (day === localDay(yesterday)) return 'Yesterday'
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: y === today.getFullYear() ? undefined : 'numeric',
  })
}
