import api from './api'

export interface LoginPayload { email: string; password: string }
export interface RegisterPayload { email: string; username: string; nome_completo: string; password: string }
export interface UserResponse { id: number; email: string; username: string }

export const login = (payload: LoginPayload) =>
  api.post<UserResponse>('/auth/login', payload).then((r) => r.data)

export const register = (payload: RegisterPayload) =>
  api.post<UserResponse>('/auth/register', payload).then((r) => r.data)

export const logout = () => api.post('/auth/logout')

export const getMe = () =>
  api.get<UserResponse>('/auth/me').then((r) => r.data)

export const updateMe = (username: string) =>
  api.put<UserResponse>('/auth/me', { username }).then((r) => r.data)

export const changePassword = (senha_atual: string, nova_senha: string) =>
  api.put('/auth/password', { senha_atual, nova_senha })

export const forgotPassword = (email: string) =>
  api.post('/auth/forgot-password', { email })

export const resetPassword = (token: string, nova_senha: string) =>
  api.post('/auth/reset-password', { token, nova_senha })

export const refreshToken = () =>
  api.post<UserResponse>('/auth/refresh').then((r) => r.data)
