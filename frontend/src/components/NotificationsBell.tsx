import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellDot, CheckCheck, MessageCircle, RotateCcw, ThumbsDown, ThumbsUp } from 'lucide-react'
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  Notification,
} from '../api'
import { useRealtime } from '../useRealtime'

function iconFor(type: string) {
  if (type === 'REVIEW_APPROVED') return <ThumbsUp size={17} />
  if (type === 'REVIEW_REJECTED') return <ThumbsDown size={17} />
  if (type === 'REVIEW_COMMENT_REPLY') return <MessageCircle size={17} />
  if (type === 'REVIEW_COMMENT_ADDED') return <MessageCircle size={17} />
  if (type === 'CHAT_MESSAGE') return <MessageCircle size={17} />
  return <RotateCcw size={17} />
}

function timeText(value: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat('ar-EG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

export default function NotificationsBell() {
  const navigate = useNavigate()
  const tick = useRealtime()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    try {
      const [list, count] = await Promise.all([getNotifications(false), getUnreadNotificationCount()])
      setItems(list)
      setUnread(count.count)
    } catch {
      // The app is still usable if notification loading fails.
    }
  }

  useEffect(() => { load() }, [tick])

  const unreadIds = useMemo(() => new Set(items.filter(x => !x.is_read).map(x => x.id)), [items])

  async function openNotification(n: Notification) {
    try {
      if (!n.is_read) {
        await markNotificationRead(n.id)
        setItems(current => current.map(x => x.id === n.id ? { ...x, is_read: true } : x))
        setUnread(current => Math.max(0, current - 1))
      }
    } finally {
      setOpen(false)
      if (n.type === 'CHAT_MESSAGE' && n.chat_sender_id) {
        navigate(`/chat?user=${n.chat_sender_id}`)
      } else if (n.review_id) {
        navigate(`/reviews/${n.review_id}${n.comment_id ? `?comment=${n.comment_id}` : ''}`)
      }
    }
  }

  async function readAll() {
    if (!unreadIds.size) return
    setLoading(true)
    try {
      await markAllNotificationsRead()
      setItems(current => current.map(x => ({ ...x, is_read: true })))
      setUnread(0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="notification-wrap">
      <button className="notification-button" aria-label="الإشعارات" onClick={() => setOpen(v => !v)}>
        {unread > 0 ? <BellDot size={21} /> : <Bell size={21} />}
        {unread > 0 && <span className="notification-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="notification-dropdown" dir="rtl">
          <div className="notification-head">
            <div><strong>الإشعارات</strong><span>{unread ? `${unread} غير مقروء` : 'كل الإشعارات مقروءة'}</span></div>
            <button className="notification-read-all" disabled={loading || unread === 0} onClick={readAll}><CheckCheck size={15} /> تحديد الكل كمقروء</button>
          </div>
          <div className="notification-list">
            {items.length === 0 ? (
              <div className="notification-empty">لا توجد إشعارات حاليًا.</div>
            ) : items.map(n => (
              <button key={n.id} className={`notification-item ${n.is_read ? '' : 'unread'}`} onClick={() => openNotification(n)}>
                <span className="notification-icon">{iconFor(n.type)}</span>
                <span className="notification-body">
                  <strong>{n.title}</strong>
                  <small>{n.message}</small>
                  <em>{timeText(n.created_at)}</em>
                </span>
                {!n.is_read && <span className="notification-unread-dot" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
