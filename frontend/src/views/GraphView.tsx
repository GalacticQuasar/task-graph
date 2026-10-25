import { Graph, layout } from '@dagrejs/dagre'
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMemo } from 'react'
import { useUpdateTask, type Group, type Task } from '../api'
import { isActionable, selfAndDescendants, type Forest } from '../forest'
import { DueDate } from '../components/TaskRow'
import { useOpenTask } from '../openTask'
import { useForest } from '../useForest'

const NODE_W = 180
const NODE_H = 56

type TaskNodeData = { task: Task; actionable: boolean; groups: Group[]; vertical: boolean }
type TaskNode = Node<TaskNodeData, 'task'>

const nodeTypes = { task: TaskNodeView }

/** Lay out open tasks with dagre: top-to-bottom on narrow screens, left-to-right otherwise. */
function layoutForest(forest: Forest, groupMap: Map<number, Group>, vertical: boolean) {
  const g = new Graph()
  g.setGraph({ rankdir: vertical ? 'TB' : 'LR', nodesep: 20, ranksep: 56 })
  g.setDefaultEdgeLabel(() => ({}))
  const edges: Edge[] = []
  for (const t of forest.byId.values()) {
    g.setNode(String(t.id), { width: NODE_W, height: NODE_H })
    // Edges to completed parents aren't drawn: those tasks aren't in the graph.
    if (t.parent_id !== null && forest.byId.has(t.parent_id)) {
      g.setEdge(String(t.parent_id), String(t.id))
      edges.push({ id: `${t.parent_id}-${t.id}`, source: String(t.parent_id), target: String(t.id) })
    }
  }
  layout(g)
  const nodes: TaskNode[] = [...forest.byId.values()].map((t) => {
    const { x, y } = g.node(String(t.id))
    return {
      id: String(t.id),
      type: 'task',
      position: { x: x - NODE_W / 2, y: y - NODE_H / 2 },
      data: {
        task: t,
        actionable: isActionable(forest, t),
        groups: t.group_ids.flatMap((id) => groupMap.get(id) ?? []),
        vertical,
      },
    }
  })
  return { nodes, edges }
}

export default function GraphView() {
  const { tasks, forest, groupMap } = useForest()
  const update = useUpdateTask()
  const openTask = useOpenTask()
  const vertical = window.matchMedia('(max-width: 600px)').matches
  const { nodes, edges } = useMemo(
    () => layoutForest(forest, groupMap, vertical),
    [forest, groupMap, vertical],
  )

  if (tasks.isPending) return <p className="status">Loading…</p>
  if (tasks.isError) return <p className="status error">Couldn't reach the server: {tasks.error.message}</p>
  if (nodes.length === 0) return <p className="status">No open tasks to graph.</p>

  // Dragging from a task's outgoing handle to another task makes the target come after it.
  // The target's old predecessor (if any) is replaced, since each task has one parent.
  function onConnect({ source, target }: Connection) {
    update.mutate({ id: Number(target), parent_id: Number(source) })
  }

  function isValidConnection({ source, target }: Edge | Connection) {
    return !selfAndDescendants(forest, Number(target)).has(Number(source))
  }

  function onEdgeClick(_: React.MouseEvent, edge: Edge) {
    const parent = forest.byId.get(Number(edge.source))
    const child = forest.byId.get(Number(edge.target))
    if (parent && child && confirm(`Detach “${child.title}” from “${parent.title}”?`)) {
      update.mutate({ id: child.id, parent_id: null })
    }
  }

  return (
    <>
      <div className="graph">
        {update.isError && <p className="error graph-error">Couldn't update: {update.error.message}</p>}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => openTask(Number(node.id))}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onEdgeClick={onEdgeClick}
          nodesDraggable={false}
          deleteKeyCode={null}
          colorMode="system"
          defaultEdgeOptions={{ style: { strokeWidth: 2 } }}
          fitView
          fitViewOptions={{ maxZoom: 1.2 }}
          minZoom={0.2}
        >
          <Background gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <p className="hint graph-hint">
        Tap a task to edit · drag from a task's dot to another task to put it after · tap a line to detach
      </p>
    </>
  )
}

function TaskNodeView({ data }: NodeProps<TaskNode>) {
  const { task, actionable, groups, vertical } = data
  return (
    <div className={actionable ? 'gnode actionable' : 'gnode'} title={task.title}>
      <Handle type="target" position={vertical ? Position.Top : Position.Left} />
      <span className="gnode-title">{task.title}</span>
      {(groups.length > 0 || task.due_date) && (
        <span className="gnode-meta">
          {groups.map((g) => (
            <span key={g.id} className="dot" style={{ background: g.color }} title={g.name} />
          ))}
          {task.due_date && <DueDate date={task.due_date} />}
        </span>
      )}
      <Handle type="source" position={vertical ? Position.Bottom : Position.Right} />
    </div>
  )
}
