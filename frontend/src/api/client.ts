import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const client = axios.create({
  baseURL: '/api',
})

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = useAuthStore.getState().refreshToken
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/token/refresh/', {
            refresh: refreshToken,
          })
          useAuthStore.getState().setAuth(
            data.access,
            refreshToken,
            useAuthStore.getState().user!,
          )
          original.headers.Authorization = `Bearer ${data.access}`
          return client(original)
        } catch {
          useAuthStore.getState().logout()
        }
      } else {
        useAuthStore.getState().logout()
      }
    }
    return Promise.reject(error)
  },
)

export default client
