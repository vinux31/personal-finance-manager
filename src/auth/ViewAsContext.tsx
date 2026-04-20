import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useAuthContext } from './AuthProvider'

export interface ViewAsUser {
  uid: string
  displayName: string
  email: string
}

interface ViewAsContextValue {
  viewingAs: ViewAsUser | null
  setViewingAs: (user: ViewAsUser | null) => void
}

const ViewAsContext = createContext<ViewAsContextValue | null>(null)

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const { isAdmin, session } = useAuthContext()
  const [viewingAs, setViewingAsState] = useState<ViewAsUser | null>(null)

  useEffect(() => {
    if (!session) setViewingAsState(null)
  }, [session])

  function setViewingAs(user: ViewAsUser | null) {
    if (!isAdmin) return
    setViewingAsState(user)
  }

  return (
    <ViewAsContext.Provider value={{ viewingAs, setViewingAs }}>
      {children}
    </ViewAsContext.Provider>
  )
}

export function useViewAsContext() {
  const ctx = useContext(ViewAsContext)
  if (!ctx) throw new Error('useViewAsContext must be used within ViewAsProvider')
  return ctx
}
