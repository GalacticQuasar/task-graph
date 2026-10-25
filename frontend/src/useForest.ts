import { useMemo } from 'react'
import { useGroups, useTasks } from './api'
import { buildForest } from './forest'

/** Every open task as a forest, plus groups by id: what task rows need to render. */
export function useForest() {
  const tasks = useTasks('all')
  const groups = useGroups()
  const forest = useMemo(() => buildForest(tasks.data ?? []), [tasks.data])
  const groupMap = useMemo(() => new Map((groups.data ?? []).map((g) => [g.id, g])), [groups.data])
  return { tasks, forest, groupMap }
}
