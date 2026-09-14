import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ExternalLink, MessageCircle, Search, Send, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  ChatConversation,
  ChatMessage,
  getChatConversations,
  getChatMessages,
  getChatUsers,
  getUnreadChatCount,
  markChatConversationRead,
  sendChatMessage,
  User,
} from '../api'
import { useRealtime } from '../useRealtime'

function timeText(value: string) {
  return new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export default function ChatDock({ user }: { user: User }) {
  const nav = useNavigate()
  const tick = useRealtime()
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [unread, setUnread] = useState(0)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const selectedUser = users.find(x => x.id === selectedId) || conversations.find(x => x.user.id === selectedId)?.user || null
  const conversationMap = useMemo(() => new Map(conversations.map(c => [c.user.id, c])), [conversations])
  const people = useMemo(() => {
    const map = new Map<number, User>()
    conversations.forEach(c => map.set(c.user.id, c.user))
    users.forEach(u => map.set(u.id, u))
    return [...map.values()]
      .filter(x => x.id !== user.id && x.display_name.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => {
        const ac = conversationMap.get(a.id)
        const bc = conversationMap.get(b.id)
        if (ac && !bc) return -1
        if (!ac && bc) return 1
        if (ac && bc) return new Date(bc.last_message.created_at).getTime() - new Date(ac.last_message.created_at).getTime()
        return a.display_name.localeCompare(b.display_name)
      })
  }, [users, conversations, user.id, search, conversationMap])

  async function loadMeta() {
    try {
      const [count, staff, chats] = await Promise.all([getUnreadChatCount(), getChatUsers(), getChatConversations()])
      setUnread(count.count)
      setUsers(staff)
      setConversations(chats)
    } catch {
      // Chat should never block the main system UI.
    }
  }

  async function loadMessages(id: number) {
    try {
      const list = await getChatMessages(id)
      setMessages(list)
      await markChatConversationRead(id)
      await loadMeta()
    } catch {
      // Keep the current panel state if the network drops briefly.
    }
  }

  useEffect(() => { loadMeta() }, [tick])
  useEffect(() => {
    if (open && selectedId) loadMessages(selectedId)
  }, [open, selectedId, tick])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length, selectedId])

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    if (!selectedId || !draft.trim() || sending) return
    const text = draft.trim()
    setSending(true)
    try {
      const sent = await sendChatMessage(selectedId, text)
      setDraft('')
      setMessages(current => current.some(x => x.id === sent.id) ? current : [...current, sent])
      await loadMeta()
    } finally {
      setSending(false)
    }
  }

  function selectPerson(id: number) {
    setSelectedId(id)
    setSearch('')
  }

  return (
    <div className="chat-dock no-print" dir="rtl">
      {open && (
        <div className="chat-dock-panel">
          <div className="chat-dock-head">
            {selectedUser ? <button onClick={() => setSelectedId(null)} aria-label="رجوع"><ArrowRight size={18} /></button> : <span className="chat-dock-brand"><MessageCircle size={18} /><strong>محادثات الفريق</strong></span>}
            {selectedUser && <div className="chat-dock-person"><strong>{selectedUser.display_name}</strong><span>{selectedUser.role}</span></div>}
            <div className="chat-dock-head-actions">
              <button onClick={() => nav(selectedId ? `/chat?user=${selectedId}` : '/chat')} aria-label="فتح صفحة المحادثات"><ExternalLink size={16} /></button>
              <button onClick={() => setOpen(false)} aria-label="إغلاق"><X size={18} /></button>
            </div>
          </div>

          {!selectedUser ? (
            <>
              <label className="chat-dock-search"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن موظف..." /></label>
              <div className="chat-dock-list">
                {people.length === 0 ? <div className="chat-dock-empty">لا توجد محادثات أو مستخدمون متاحون.</div> : people.map(person => {
                  const c = conversationMap.get(person.id)
                  return <button key={person.id} className="chat-dock-row" onClick={() => selectPerson(person.id)}>
                    <span className="chat-avatar">{person.display_name.trim().charAt(0).toUpperCase()}</span>
                    <span className="chat-dock-row-body"><strong>{person.display_name}</strong><small>{c?.last_message.content || person.role}</small></span>
                    {!!c?.unread_count && <span className="chat-unread-badge">{c.unread_count > 99 ? '99+' : c.unread_count}</span>}
                  </button>
                })}
              </div>
            </>
          ) : (
            <>
              <div className="chat-dock-messages">
                {messages.length === 0 ? <div className="chat-dock-empty">لا توجد رسائل بعد. ابدأ المحادثة.</div> : messages.map(message => {
                  const mine = message.sender_id === user.id
                  return <div key={message.id} className={`chat-message-row ${mine ? 'mine' : 'theirs'}`}><div className="chat-bubble"><p>{message.content}</p><span>{timeText(message.created_at)}{mine && message.is_read ? ' · تمت القراءة' : ''}</span></div></div>
                })}
                <div ref={bottomRef} />
              </div>
              <form className="chat-dock-compose" onSubmit={submit}>
                <textarea value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }} maxLength={5000} placeholder="اكتب رسالة..." />
                <button type="submit" disabled={sending || !draft.trim()} aria-label="إرسال"><Send size={17} /></button>
              </form>
            </>
          )}
        </div>
      )}

      <button className={`chat-dock-toggle ${open ? 'open' : ''}`} onClick={() => setOpen(v => !v)} aria-label="المحادثات">
        <MessageCircle size={24} />
        {unread > 0 && <span>{unread > 99 ? '99+' : unread}</span>}
      </button>
    </div>
  )
}
