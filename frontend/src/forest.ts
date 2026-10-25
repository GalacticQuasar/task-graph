import type { Task } from './api'

/** Open tasks indexed for rendering sequences. Built from the server's `view=all` list. */
export type Forest = {
  byId: Map<number, Task>
  children: Map<number, Task[]>
}

export function buildForest(open: Task[]): Forest {
  const byId = new Map(open.map((t) => [t.id, t]))
  const children = new Map<number, Task[]>()
  for (const t of open) {
    if (t.parent_id === null) continue
    const siblings = children.get(t.parent_id)
    if (siblings) siblings.push(t)
    else children.set(t.parent_id, [t])
  }
  return { byId, children }
}

/**
 * Mirrors backend `graph.list_tasks(View.ACTIONABLE)`: an open task is actionable when it
 * has no parent or its parent is done. `byId` holds only open tasks, so a parent missing
 * from it is a completed one.
 */
export function isActionable(forest: Forest, task: Task): boolean {
  return task.parent_id === null || !forest.byId.has(task.parent_id)
}

/** Number of open tasks downstream of `id`. */
export function countDescendants(forest: Forest, id: number): number {
  let n = 0
  for (const child of forest.children.get(id) ?? []) n += 1 + countDescendants(forest, child.id)
  return n
}
