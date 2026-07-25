import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  user_type: string
  status: string
  is_active: boolean
  otp_verified: boolean
  created: string
  updated: string
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  setAuth: (access: string, refresh: string, user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'streams-auth' },
  ),
)
