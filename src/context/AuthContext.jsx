import { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '../lib/firebase'
import { DEMO_MODE } from '../lib/financeData'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth'

const AuthContext = createContext(null)

const DEMO_SESSION_KEY = 'gesa-finance-demo-admin'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (DEMO_MODE) {
      const isAdmin = sessionStorage.getItem(DEMO_SESSION_KEY) === 'true'
      setUser(isAdmin ? { email: 'finance@gesa.demo' } : null)
      setLoading(false)
      return
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  async function login(email, password) {
    if (DEMO_MODE) {
      // Demo mode: any non-empty credentials sign you in, so the flow can be
      // explored before real Firebase Authentication is configured.
      if (!email || !password) throw new Error('Enter an email and password.')
      sessionStorage.setItem(DEMO_SESSION_KEY, 'true')
      setUser({ email })
      return
    }
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
    if (adminEmail && email.trim().toLowerCase() !== adminEmail.trim().toLowerCase()) {
      throw new Error('This account is not authorized as finance admin.')
    }
    const cred = await signInWithEmailAndPassword(auth, email, password)
    setUser(cred.user)
  }

  async function logout() {
    if (DEMO_MODE) {
      sessionStorage.removeItem(DEMO_SESSION_KEY)
      setUser(null)
      return
    }
    await fbSignOut(auth)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
