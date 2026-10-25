import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type Task = {
  id: number
  title: string
  notes: string
  parent_id: number | null
  due_date: string | null
  position: number
  created_at: string
  completed_at: string | null
  group_ids: number[]
}

export type Group = {
  id: number
  name: string
  color: string
}

export type View = 'actionable' | 'all' | 'inbox' | 'completed'

export type TaskCreate = {
  title: string
  parent_id?: number | null
  group_ids?: number[]
  due_date?: string | null
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      // non-JSON error body; keep statusText
    }
    throw new ApiError(res.status, String(detail))
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

export const api = {
  listTasks: (view: View, group?: number) =>
    request<Task[]>(`/tasks?view=${view}${group === undefined ? '' : `&group=${group}`}`),
  createTask: (body: TaskCreate) => post<Task>('/tasks', body),
  completeTask: (id: number) => post<Task>(`/tasks/${id}/complete`),
  uncompleteTask: (id: number) => post<Task>(`/tasks/${id}/uncomplete`),
  listGroups: () => request<Group[]>('/groups'),
  createGroup: (body: { name: string; color: string }) => post<Group>('/groups', body),
}

// --- query hooks ---

export function useTasks(view: View, group?: number) {
  return useQuery({
    queryKey: ['tasks', view, group],
    queryFn: () => api.listTasks(view, group),
  })
}

export function useGroups() {
  return useQuery({ queryKey: ['groups'], queryFn: api.listGroups })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useSetDone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      done ? api.completeTask(id) : api.uncompleteTask(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })
}
