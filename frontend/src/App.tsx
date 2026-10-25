import { lazy, Suspense, useEffect, useState } from 'react'
import { useTasks } from './api'
import { GroupChips } from './components/GroupChips'
import { QuickAdd } from './components/QuickAdd'
import { TaskEditor } from './components/TaskEditor'
import { OpenTaskContext } from './openTask'
import { Actionable } from './views/Actionable'
import { Completed } from './views/Completed'
import { Inbox } from './views/Inbox'

// React Flow + dagre are heavy; load them only when the Graph tab is opened.
const GraphView = lazy(() => import('./views/GraphView'))

const SHOW_ALL_KEY = 'taskgraph.showAll'

type Tab = 'next' | 'inbox' | 'graph' | 'done'
const TABS: { id: Tab; label: string }[] = [
  { id: 'next', label: 'Up next' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'graph', label: 'Graph' },
  { id: 'done', label: 'Done' },
]

function readShowAll(): boolean {
  try {
    return localStorage.getItem(SHOW_ALL_KEY) === '1'
  } catch {
    return false
  }
}

// The tab lives in the URL hash so the phone's back button and home-screen links work.
function tabFromHash(): Tab {
  const hash = location.hash.slice(1)
  return TABS.some((t) => t.id === hash) ? (hash as Tab) : 'next'
}

export default function App() {
  const [tab, setTab] = useState(tabFromHash)
  const [groupId, setGroupId] = useState<number | undefined>()
  const [showAll, setShowAll] = useState(readShowAll)
  const [editingId, setEditingId] = useState<number | null>(null)
  const inbox = useTasks('inbox')

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function toggleShowAll() {
    const next = !showAll
    setShowAll(next)
    try {
      localStorage.setItem(SHOW_ALL_KEY, next ? '1' : '0')
    } catch {
      // storage unavailable; the toggle still works for this session
    }
  }

  return (
    <OpenTaskContext.Provider value={setEditingId}>
      <main className={tab === 'graph' ? 'app wide' : 'app'}>
        <nav className="tabs" aria-label="Views">
          {TABS.map((t) => (
            <a key={t.id} href={`#${t.id}`} aria-current={tab === t.id ? 'page' : undefined}>
              {t.label}
              {t.id === 'inbox' && !!inbox.data?.length && <span className="badge">{inbox.data.length}</span>}
            </a>
          ))}
        </nav>

        {tab === 'next' && (
          <>
            <header className="header">
              <h1>{showAll ? 'All tasks' : 'Up next'}</h1>
              <button className="toggle" aria-pressed={showAll} onClick={toggleShowAll}>
                {showAll ? 'Heads only' : 'Show all'}
              </button>
            </header>
            <QuickAdd groupIds={groupId === undefined ? [] : [groupId]} placeholder="Add a task" />
            <GroupChips selected={groupId} onSelect={setGroupId} />
            <Actionable groupId={groupId} showAll={showAll} />
          </>
        )}
        {tab === 'inbox' && (
          <>
            <header className="header">
              <h1>Inbox</h1>
            </header>
            <QuickAdd placeholder="Capture a task" />
            <Inbox />
          </>
        )}
        {tab === 'graph' && (
          <Suspense fallback={<p className="status">Loading graph…</p>}>
            <GraphView />
          </Suspense>
        )}
        {tab === 'done' && (
          <>
            <header className="header">
              <h1>Done</h1>
            </header>
            <Completed />
          </>
        )}
      </main>
      {editingId !== null && <TaskEditor taskId={editingId} onClose={() => setEditingId(null)} />}
    </OpenTaskContext.Provider>
  )
}
