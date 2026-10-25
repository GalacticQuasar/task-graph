import { useState } from 'react'
import { useLogin } from '../api'

export function Login() {
  const [token, setToken] = useState('')
  const login = useLogin()

  return (
    <main className="app login">
      <h1>Task Graph</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          login.mutate(token)
        }}
      >
        <label className="field">
          <span>Access token</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </label>
        {login.isError && (
          <p className="error">{login.error.message === 'wrong token' ? 'That token is not right.' : login.error.message}</p>
        )}
        <button type="submit" className="primary" disabled={login.isPending || !token}>
          Log in
        </button>
      </form>
      <p className="hint">This is the TASKGRAPH_TOKEN the server was started with. You stay logged in on this device.</p>
    </main>
  )
}
