import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useMemo, useState } from 'react'
import { useUpdateTask, type Group, type Task } from '../api'
import { isActionable, selfAndDescendants, type Forest } from '../forest'
import { TaskRow } from './TaskRow'

const ROOT = 'root'

type Props = {
  roots: Task[]
  /** Ids rendered in the tree (open tasks matching the current filter). */
  shown: Set<number>
  forest: Forest
  groups: Map<number, Group>
  onToggle: (task: Task) => void
}

/**
 * Indented tree of open tasks. Drag a task's grip onto another task to make it come after
 * that task, or onto the top drop zone to start a new sequence.
 */
export function TaskTree({ roots, ...rest }: Props) {
  const update = useUpdateTask()
  const [activeId, setActiveId] = useState<number | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  // Dropping a task onto itself or anything downstream of it would create a cycle.
  const blocked = useMemo(
    () => (activeId === null ? new Set<number>() : selfAndDescendants(rest.forest, activeId)),
    [activeId, rest.forest],
  )
  const active = activeId === null ? undefined : rest.forest.byId.get(activeId)

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) return
    const task = rest.forest.byId.get(Number(active.id))
    const parentId = over.id === ROOT ? null : Number(over.id)
    if (!task || task.parent_id === parentId) return
    update.mutate({ id: task.id, parent_id: parentId })
  }

  return (
    <DndContext
      sensors={sensors}
      // Drop onto whatever is under the pointer, not whatever the row-sized overlay overlaps most.
      collisionDetection={pointerWithin}
      onDragStart={(e) => setActiveId(Number(e.active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={onDragEnd}
    >
      {update.isError && <p className="error">Couldn't move task: {update.error.message}</p>}
      <RootDropZone visible={active !== undefined && active.parent_id !== null} />
      <Branch tasks={roots} activeId={activeId} blocked={blocked} {...rest} />
      <DragOverlay dropAnimation={null}>
        {active && <div className="drag-overlay">{active.title}</div>}
      </DragOverlay>
    </DndContext>
  )
}

type BranchProps = Omit<Props, 'roots'> & {
  tasks: Task[]
  activeId: number | null
  blocked: Set<number>
}

function Branch({ tasks, ...props }: BranchProps) {
  return (
    <ul className="tasks">
      {tasks.map((t) => (
        <TreeNode key={t.id} task={t} {...props} />
      ))}
    </ul>
  )
}

function TreeNode({ task, ...props }: Omit<BranchProps, 'tasks'> & { task: Task }) {
  const { forest, groups, onToggle, shown, activeId, blocked } = props
  const { setNodeRef: setDragRef, setActivatorNodeRef, listeners, attributes, isDragging } =
    useDraggable({ id: task.id })
  const drop = useDroppable({ id: task.id, disabled: blocked.has(task.id) })
  // The whole row is both the drag node (so the overlay gets its size) and the drop target;
  // only the grip starts a drag.
  const rowRef = (el: HTMLElement | null) => {
    setDragRef(el)
    drop.setNodeRef(el)
  }
  const kids = (forest.children.get(task.id) ?? []).filter((c) => shown.has(c.id))

  const state = isDragging
    ? 'dragging'
    : drop.isOver
      ? 'over'
      : activeId !== null && blocked.has(task.id)
        ? 'blocked'
        : undefined

  const handle = (
    <button
      className="grip"
      ref={setActivatorNodeRef}
      {...listeners}
      {...attributes}
      aria-label={`Move ${task.title}`}
      title="Drag onto another task to put this after it"
    >
      ⠿
    </button>
  )

  return (
    <TaskRow
      task={task}
      forest={forest}
      groups={groups}
      onToggle={onToggle}
      dimmed={!isActionable(forest, task)}
      dnd={{ handle, rowRef, state }}
    >
      {kids.length > 0 && <Branch tasks={kids} {...props} />}
    </TaskRow>
  )
}

function RootDropZone({ visible }: { visible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT, disabled: !visible })
  if (!visible) return null
  return (
    <div ref={setNodeRef} className={isOver ? 'root-drop over' : 'root-drop'}>
      Drop here to start a new sequence
    </div>
  )
}
