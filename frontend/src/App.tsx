import { useState } from 'react'
import { GroupChips } from './components/GroupChips'
import { QuickAdd } from './components/QuickAdd'
import { Actionable } from './views/Actionable'

const SHOW_ALL_KEY = 'taskgraph.showAll'

function readShowAll(): boolean {
  try {
    return localStorage.getItem(SHOW_ALL_KEY) === '1'
  } catch {
    return false
  }
}

export default function App() {
  const [groupId, setGroupId] = useState<number | undefined>()
  const [showAll, setShowAll] = useState(readShowAll)

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
    <main className="app">
      <header className="header">
        <h1>{showAll ? 'All tasks' : 'Up next'}</h1>
        <button className="toggle" aria-pressed={showAll} onClick={toggleShowAll}>
          {showAll ? 'Heads only' : 'Show all'}
        </button>
      </header>
      <QuickAdd
        groupIds={groupId === undefined ? [] : [groupId]}
        placeholder="Add a task"
      />
      <GroupChips selected={groupId} onSelect={setGroupId} />
      <Actionable groupId={groupId} showAll={showAll} />
    </main>
  )
}
