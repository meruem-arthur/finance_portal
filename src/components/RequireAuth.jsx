import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-white/40">Loading…</div>
  if (!user) return <Navigate to="/admin/login" replace />
  return children
}
