import { useAuthContext } from './AuthProvider'
import { useViewAsContext } from './ViewAsContext'

export function useTargetUserId(): string | undefined {
  const { user } = useAuthContext()
  const { viewingAs } = useViewAsContext()
  return viewingAs?.uid ?? user?.id
}
