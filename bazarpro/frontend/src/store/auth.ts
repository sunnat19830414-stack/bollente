import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  role:  string | null
  name:  string | null
  store_id: number
  setAuth: (token: string, role: string, name: string, store_id: number) => void
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token:    null,
      role:     null,
      name:     null,
      store_id: 1,
      setAuth:  (token, role, name, store_id) => set({ token, role, name, store_id }),
      logout:   () => set({ token: null, role: null, name: null }),
    }),
    { name: 'bazarpro-auth' }
  )
)
