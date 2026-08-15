import api from './api'
import type { PatchPerfil } from '../lib/preferencias'

export interface LoginPayload { email: string; password: string }
export interface RegisterPayload { email: string; nome_completo: string; password: string }
// Espelha o UserResponse do backend. O `username` é auto-gerado do e-mail e não
// é exposto na UI (PLANO_PERFIL_CONFIG) — fica aqui só porque a rota o devolve.
export interface UserResponse {
  id: number
  email: string
  username: string
  nome_completo: string
  criado_em: string
  ativo: boolean
  // #6 — estado do toggle de Configurações › Notificações. Vem do servidor
  // para a tela não precisar assumir o default (que é ligado).
  notificar_vencimento: boolean
}

export const login = (payload: LoginPayload) =>
  api.post<UserResponse>('/auth/login', payload).then((r) => r.data)

export const register = (payload: RegisterPayload) =>
  api.post<UserResponse>('/auth/register', payload).then((r) => r.data)

export const logout = () => api.post('/auth/logout')

// Revoga TODAS as sessões, incluindo esta: o backend limpa os cookies deste
// dispositivo junto (o refresh daqui também é revogado — mantê-lo deixaria o
// cliente com um token morto na mão). Por isso a UI sai para o /login depois.
export const logoutAll = () => api.post('/auth/logout-all')

// Recibo do reset: quantas linhas saíram de cada tabela. É o motivo de a rota
// responder 200 e não 204 — ação irreversível merece extrato.
export interface ResetDataResponse {
  parcelas: number
  transacoes: number
  pagamentos_fatura: number
  cartoes: number
  recorrencia_vigencias: number
  recorrencias: number
  chat_messages: number
}

// "Começar do zero": zera os lançamentos e PRESERVA a conta (o usuário continua
// logado) e as categorias customizadas. Reautenticação obrigatória — é irreversível.
export const resetData = (password: string) =>
  api.post<ResetDataResponse>('/auth/reset-data', { password }).then((r) => r.data)

export const getMe = () =>
  api.get<UserResponse>('/auth/me').then((r) => r.data)

// PUT /auth/me aplica só os campos que vêm (exclude_unset). A UI do Perfil edita
// apenas o nome — antes este updateMe mandava {username} sob o rótulo "Nome".
export const updateMe = (nome_completo: string) =>
  api.put<UserResponse>('/auth/me', { nome_completo }).then((r) => r.data)

// Mesma rota, campo diferente. Separado de `updateMe` porque o patch é montado
// por `lib/preferencias` — onde o `false` está provado por teste de não sumir
// (é o valor que as formas idiomáticas de payload condicional descartam).
export const updatePreferencia = (patch: PatchPerfil) =>
  api.put<UserResponse>('/auth/me', patch).then((r) => r.data)

// F-07/LGPD: reautenticação obrigatória — um cookie sozinho não exclui a conta.
export const deleteMe = (password: string) =>
  api.delete('/auth/me', { data: { password } })

export const changePassword = (senha_atual: string, nova_senha: string) =>
  api.put('/auth/password', { senha_atual, nova_senha })

export const forgotPassword = (email: string) =>
  api.post('/auth/forgot-password', { email })

export const resetPassword = (token: string, nova_senha: string) =>
  api.post('/auth/reset-password', { token, nova_senha })

export const refreshToken = () =>
  api.post<UserResponse>('/auth/refresh').then((r) => r.data)
