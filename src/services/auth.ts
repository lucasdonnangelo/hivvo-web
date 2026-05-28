import api from './api'

export interface LoginPayload { email: string; password: string }
export interface RegisterPayload { email: string; username: string; password: string }
export interface UserResponse { id: number; email: string; username: string }

export const login = (payload: LoginPayload) =>
  api.post<UserResponse>('/auth/login', payload).then((r) => r.data)

export const register = (payload: RegisterPayload) =>
  api.post<UserResponse>('/auth/register', payload).then((r) => r.data)

export const logout = () => api.post('/auth/logout')

export const getMe = () =>
  api.get<UserResponse>('/auth/me').then((r) => r.data)
