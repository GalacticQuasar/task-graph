import { createContext, useContext } from 'react'

/** Opens the task editor sheet for a task id; provided by App. */
export const OpenTaskContext = createContext<(id: number) => void>(() => {})

export const useOpenTask = () => useContext(OpenTaskContext)
