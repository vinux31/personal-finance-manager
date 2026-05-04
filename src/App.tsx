import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import { Toaster } from '@/components/ui/sonner'
import LoginScreen from '@/components/LoginScreen'
import { useAuth } from '@/auth/useAuth'

function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-muted-foreground text-sm">Memuat...</span>
      </div>
    )
  }

  if (!session) {
    return (
      <>
        <LoginScreen />
        <Toaster richColors position="top-right" />
      </>
    )
  }

  return (
    <>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </>
  )
}

export default App
