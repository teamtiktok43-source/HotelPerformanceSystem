export const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export const getLocalDateString = (value = new Date()) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export type User = { id: number; username: string; display_name: string; role: string; active: boolean }
export type Hotel = { id: number; name: string; commission_rate: number; tax_rate: number; active: boolean }
export type Platform = { id: number; name: string; active: boolean }
export type ReviewComment = {
  id: number
  review_id: number
  author_id: number
  author_name: string
  author_role: string
  content: string
  parent_comment_id?: number | null
  created_at: string
  updated_at?: string | null
  unread?: boolean
}
export type Review = {
  id: number
  booking_number: string
  hotel_id: number
  hotel_name: string
  rating: number
  comment: string
  platform_id?: number | null
  platform_name: string
  sentiment: string
  review_date: string
  proposed_action: string
  employee_id: number
  employee_name: string
  status: string
  rejection_reason?: string
  manager_id?: number | null
  manager_name?: string
  manager_decided_at?: string | null
  created_at: string
  updated_at?: string | null
  unread_comment_count?: number
  comments?: ReviewComment[]
}
export type SmartEntryReviewInput = {
  rating: number
  comment: string
  sentiment: 'Positive' | 'Negative' | 'Neutral'
  proposed_action: string
}
export type SmartEntryItemInput = {
  booking_number: string
  payment_status: 'Paid' | 'Cash'
  platform_id: number
  actual_price: number
  commissionable_amount?: number
  review?: SmartEntryReviewInput | null
}
export type SmartEntryPayload = {
  hotel_id: number
  entry_date: string
  employee_id?: number
  items: SmartEntryItemInput[]
}
export type SmartEntryResult = {
  message: string
  hotel_id: number
  entry_date: string
  reservations: number
  paid_bookings: number
  cash_bookings: number
  booking_records: number
  revenue_records: number
  review_records: number
  total_actual_price: number
  total_net_revenue: number
  booking_ids: number[]
  revenue_ids: number[]
  review_ids: number[]
}

export type ChatMessage = {
  id: number
  sender_id: number
  sender_name: string
  recipient_id: number
  recipient_name: string
  content: string
  is_read: boolean
  read_at?: string | null
  created_at: string
}

export type ChatConversation = {
  user: User
  last_message: ChatMessage
  unread_count: number
}

export type PublicLicenseInfo = {
  active: boolean
  renewal_price: number
  renewal_currency: string
  suspension_title: string
  suspension_message: string
}

export type LicenseInfo = PublicLicenseInfo & {
  activated_at: string | null
  expires_at: string | null
  remaining_days: number
  remaining_seconds: number
  owner_user_id: number
}

export type LicenseSettings = {
  renewal_price: number
  renewal_currency: string
  suspension_title: string
  suspension_message: string
}

export type Notification = {
  id: number
  recipient_id: number
  type: string
  title: string
  message: string
  review_id?: number | null
  comment_id?: number | null
  chat_message_id?: number | null
  chat_sender_id?: number | null
  is_read: boolean
  read_at?: string | null
  created_at: string
}

const token = () => localStorage.getItem('hps_token') || ''

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const t = token()
  if (t) headers.set('Authorization', `Bearer ${t}`)
  const r = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) {
    if (d.detail === 'LICENSE_EXPIRED') {
      window.dispatchEvent(new CustomEvent('hps-license-expired'))
      throw new Error('LICENSE_EXPIRED')
    }
    if (d.detail === 'INVALID_OR_USED_LICENSE_KEY') throw new Error('مفتاح التفعيل غير صالح أو تم استخدامه من قبل.')
    throw new Error(d.detail || 'حدث خطأ في الاتصال')
  }
  return d as T
}

export const getPublicLicense = () => apiFetch<PublicLicenseInfo>('/api/system/license/public')
export const getLicense = () => apiFetch<LicenseInfo>('/api/system/license')
export const updateLicenseSettings = (settings: LicenseSettings) =>
  apiFetch<{ message: string; license: LicenseInfo }>('/api/system/license/settings', { method: 'PATCH', body: JSON.stringify(settings) })
export const createLicenseKey = () => apiFetch<{ activation_key: string; created_at: string; duration_days: number }>('/api/system/license/keys', { method: 'POST' })
export const activateLicense = (activationKey: string) => apiFetch<{ message: string; license: LicenseInfo }>('/api/system/license/activate', { method: 'POST', body: JSON.stringify({ activation_key: activationKey }) })
export const deactivateLicense = () => apiFetch<{ message: string; license: LicenseInfo }>('/api/system/license/deactivate', { method: 'POST' })

export const getHotels = () => apiFetch<Hotel[]>('/api/hotels')
export const getPlatforms = () => apiFetch<Platform[]>('/api/platforms')
export const createPlatform = (b: any) => apiFetch<Platform>('/api/platforms', { method: 'POST', body: JSON.stringify(b) })
export const updatePlatform = (id: number, b: any) => apiFetch<Platform>(`/api/platforms/${id}`, { method: 'PATCH', body: JSON.stringify(b) })
export const getEmployees = () => apiFetch<User[]>('/api/employees')
export const getDashboard = (params: string) => apiFetch<any>(`/api/dashboard?${params}`)
export const getBookings = (params = '') => apiFetch<any[]>(`/api/bookings?${params}`)
export const getRevenue = (params = '') => apiFetch<any[]>(`/api/revenue?${params}`)
export const getReviews = (params = '') => apiFetch<Review[]>(`/api/reviews?${params}`)
export const getReviewDetail = (id: number) => apiFetch<Review>(`/api/reviews/${id}`)
export const getRatings = (year?: number, month?: number) => apiFetch<any[]>(`/api/ratings${year && month ? `?year=${year}&month=${month}` : ''}`)
export const getMonthly = (y: number, m: number, hotelId?: number) => apiFetch<any>(`/api/monthly-report?year=${y}&month=${m}${hotelId ? `&hotel_id=${hotelId}` : ''}`)
export const createSmartEntry = (body: SmartEntryPayload) =>
  apiFetch<SmartEntryResult>('/api/smart-entry', { method: 'POST', body: JSON.stringify(body) })

export const createBooking = (b: any) => apiFetch<any>('/api/bookings', { method: 'POST', body: JSON.stringify(b) })
export const createRevenue = (b: any) => apiFetch<any>('/api/revenue', { method: 'POST', body: JSON.stringify(b) })
export const createReview = (b: any) => apiFetch<Review>('/api/reviews', { method: 'POST', body: JSON.stringify(b) })
export const decideReview = (id: number, status: string, rejectionReason?: string) =>
  apiFetch<Review>(`/api/reviews/${id}/decision`, { method: 'PATCH', body: JSON.stringify({ status, rejection_reason: rejectionReason }) })
export const addReviewComment = (id: number, content: string, parentCommentId?: number) =>
  apiFetch<ReviewComment>(`/api/reviews/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content, parent_comment_id: parentCommentId ?? null }),
  })
export const createHotel = (b: any) => apiFetch<any>('/api/hotels', { method: 'POST', body: JSON.stringify(b) })
export const updateHotel = (id: number, b: any) => apiFetch<any>(`/api/hotels/${id}`, { method: 'PATCH', body: JSON.stringify(b) })
export const createEmployee = (b: any) => apiFetch<any>('/api/employees', { method: 'POST', body: JSON.stringify(b) })
export const updateEmployee = (id: number, b: any) => apiFetch<any>(`/api/employees/${id}`, { method: 'PATCH', body: JSON.stringify(b) })
export const deleteEmployee = (id: number) => apiFetch<any>(`/api/employees/${id}`, { method: 'DELETE' })
export const getData = () => apiFetch<any>('/api/data')
export const deleteDataMonth = (year: number, month: number) => apiFetch<any>(`/api/data/month?year=${year}&month=${month}`, { method: 'DELETE' })
export const updateBooking = (id: number, b: any) => apiFetch<any>(`/api/bookings/${id}`, { method: 'PATCH', body: JSON.stringify(b) })
export const deleteBooking = (id: number) => apiFetch<any>(`/api/bookings/${id}`, { method: 'DELETE' })
export const updateRevenue = (id: number, b: any) => apiFetch<any>(`/api/revenue/${id}`, { method: 'PATCH', body: JSON.stringify(b) })
export const deleteRevenue = (id: number) => apiFetch<any>(`/api/revenue/${id}`, { method: 'DELETE' })
export const updateReview = (id: number, b: any) => apiFetch<Review>(`/api/reviews/${id}`, { method: 'PATCH', body: JSON.stringify(b) })
export const deleteReview = (id: number) => apiFetch<any>(`/api/reviews/${id}`, { method: 'DELETE' })

export const getNotifications = (unreadOnly = false) => apiFetch<Notification[]>(`/api/notifications${unreadOnly ? '?unread_only=true' : ''}`)
export const getUnreadNotificationCount = () => apiFetch<{ count: number }>('/api/notifications/unread-count')
export const markNotificationRead = (id: number) => apiFetch<Notification>(`/api/notifications/${id}/read`, { method: 'PATCH' })
export const markAllNotificationsRead = () => apiFetch<{ updated: number }>('/api/notifications/read-all', { method: 'POST' })

export const getChatUsers = () => apiFetch<User[]>('/api/chat/users')
export const getChatConversations = () => apiFetch<ChatConversation[]>('/api/chat/conversations')
export const getChatMessages = (userId: number, beforeId?: number) =>
  apiFetch<ChatMessage[]>(`/api/chat/messages/${userId}${beforeId ? `?before_id=${beforeId}` : ''}`)
export const sendChatMessage = (recipientId: number, content: string) =>
  apiFetch<ChatMessage>('/api/chat/messages', { method: 'POST', body: JSON.stringify({ recipient_id: recipientId, content }) })
export const markChatConversationRead = (userId: number) =>
  apiFetch<{ updated: number }>(`/api/chat/conversations/${userId}/read`, { method: 'POST' })
export const getUnreadChatCount = () => apiFetch<{ count: number }>('/api/chat/unread-count')

export const saveAuth = (u: User, t: string) => { localStorage.setItem('hps_token', t); localStorage.setItem('hps_user', JSON.stringify(u)) }
export const getAuthUser = (): User | null => { try { return JSON.parse(localStorage.getItem('hps_user') || 'null') } catch { return null } }
export const logout = () => { localStorage.removeItem('hps_token'); localStorage.removeItem('hps_user') }

export function connectRealtime(onEvent: (e: any) => void) {
  const t = token()
  if (!t) return () => {}
  const url = API_BASE.replace(/^http/, 'ws') + `/ws?token=${encodeURIComponent(t)}`
  let ws: WebSocket | undefined
  let stopped = false
  let timer: number | undefined
  const open = () => {
    if (stopped) return
    ws = new WebSocket(url)
    ws.onmessage = e => { try { onEvent(JSON.parse(e.data)) } catch {} }
    ws.onclose = () => { if (!stopped) timer = window.setTimeout(open, 1500) }
  }
  open()
  return () => { stopped = true; if (timer) window.clearTimeout(timer); ws?.close() }
}
