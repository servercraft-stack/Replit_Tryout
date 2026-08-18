import client from './client'

export interface User {
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

export interface AuthTokens {
  refresh: string
  access: string
}

export async function login(email: string, password: string) {
  const { data } = await client.post('/auth/login/', { email, password })
  return data as { message: string; tokens: AuthTokens; user: User }
}

export async function register(payload: {
  email: string
  password: string
  password_confirm: string
  first_name: string
  last_name: string
}) {
  const { data } = await client.post('/auth/register/', payload)
  return data as { message: string; user: User }
}

export async function verifyOtp(email: string, otp: string) {
  const { data } = await client.post('/auth/verify-otp/', { email, otp })
  return data as { message: string; user: User }
}

export async function resendOtp(email: string) {
  const { data } = await client.post('/auth/resend-otp/', { email })
  return data as { message: string }
}

export async function getProfile() {
  const { data } = await client.get('/auth/me/')
  return data as User
}

export async function updateProfile(payload: { first_name?: string; last_name?: string; email?: string }) {
  const { data } = await client.patch('/auth/me/', payload)
  return data as User
}

export async function changePassword(oldPassword: string, newPassword: string, confirmPassword: string) {
  const { data } = await client.post('/auth/change-password/', { current_password: oldPassword, new_password: newPassword, new_password_confirm: confirmPassword })
  return data as { message: string }
}

export async function deleteAccount(password: string) {
  const { data } = await client.post('/auth/delete-account/', { password })
  return data as { message: string }
}

export async function requestPasswordReset(email: string) {
  const { data } = await client.post('/auth/password/reset/', { email })
  return data as { message: string }
}

export async function confirmPasswordReset(email: string, otp: string, newPassword: string, confirmPassword: string) {
  const { data } = await client.post('/auth/password/reset/confirm/', { email, otp, new_password: newPassword, new_password_confirm: confirmPassword })
  return data as { message: string }
}

export async function getUserProfile(userId: string) {
  const { data } = await client.get(`/auth/users/${userId}/`)
  return data as User
}

export async function logout(refreshToken: string) {
  const { data } = await client.post('/auth/logout/', { refresh: refreshToken })
  return data as { message: string }
}
