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

export type TaskUpdate = {
  title?: string
  notes?: string
  parent_id?: number | null
  due_date?: string | null
  group_ids?: number[]
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
  getTask: (id: number) => request<Task>(`/tasks/${id}`),
  createTask: (body: TaskCreate) => post<Task>('/tasks', body),
  updateTask: (id: number, body: TaskUpdate) =>
    request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTask: (id: number) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
  completeTask: (id: number) => post<Task>(`/tasks/${id}/complete`),
  uncompleteTask: (id: number) => post<Task>(`/tasks/${id}/uncomplete`),
  me: () => request<{ authenticated: boolean; auth_enabled: boolean }>('/me'),
  login: (token: string) => post<void>('/login', { token }),
  logout: () => post<void>('/logout'),
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

export function useTask(id: number) {
  // Lives under the 'tasks' prefix so every task mutation's invalidation refreshes it too.
  return useQuery({ queryKey: ['tasks', 'one', id], queryFn: () => api.getTask(id) })
}

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: api.me, retry: false, staleTime: Infinity })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['login'],
    mutationFn: api.login,
    // Everything fetched while logged out failed with 401; refetch it all.
    onSuccess: () => qc.invalidateQueries(),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.logout,
    // Back to initial state and refetch: /me now 401s, which shows the login screen.
    onSuccess: () => qc.resetQueries(),
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

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: TaskUpdate & { id: number }) => api.updateTask(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteTask,
    onSuccess: (_data, id) => {
      // Drop the deleted task's own query instead of refetching it into a 404.
      const own = ['tasks', 'one', id]
      qc.removeQueries({ queryKey: own, exact: true })
      return qc.invalidateQueries({
        queryKey: ['tasks'],
        predicate: (q) => q.queryKey.join() !== own.join(),
      })
    },
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
