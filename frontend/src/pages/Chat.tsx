import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, Search, Send, Users } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import {
  ChatConversation,
  ChatMessage,
  getChatConversations,
  getChatMessages,
  getChatUsers,
  markChatConversationRead,
  sendChatMessage,
  User,
} from '../api'
import { useRealtime } from '../useRealtime'

function messageTime(value: string) {
  return new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function listTime(value: string) {
  return new Intl.DateTimeFormat('ar-EG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export default function Chat({ user }: { user: User }) {
  const tick = useRealtime()
  const [searchParams, setSearchParams] = useSearchParams()
  const [users, setUsers] = useState<User[]>([])
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const raw = Number(searchParams.get('user'))
    return Number.isFinite(raw) && raw > 0 ? raw : null
  })
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const conversationMap = useMemo(() => new Map(conversations.map(c => [c.user.id, c])), [conversations])
  const selectedUser = users.find(x => x.id === selectedId) || conversations.find(x => x.user.id === selectedId)?.user || null

  const people = useMemo(() => {
    const map = new Map<number, User>()
    conversations.forEach(c => map.set(c.user.id, c.user))
    users.forEach(u => map.set(u.id, u))
    return [...map.values()]
      .filter(u => u.id !== user.id && u.display_name.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => {
        const ac = conversationMap.get(a.id)
        const bc = conversationMap.get(b.id)
        if (ac && !bc) return -1
        if (!ac && bc) return 1
        if (ac && bc) return new Date(bc.last_message.created_at).getTime() - new Date(ac.last_message.created_at).getTime()
        return a.display_name.localeCompare(b.display_name)
      })
  }, [conversations, users, user.id, search, conversationMap])

  async function loadSidebar() {
    try {
      const [staff, chats] = await Promise.all([getChatUsers(), getChatConversations()])
      setUsers(staff)
      setConversations(chats)
    } catch {
      // Keep the rest of the system usable if chat is temporarily unavailable.
    }
  }

  async function loadConversation(userId: number) {
    try {
      const list = await getChatMessages(userId)
      setMessages(list)
      await markChatConversationRead(userId)
      await loadSidebar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل المحادثة')
    }
  }

  useEffect(() => { loadSidebar() }, [tick])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    loadConversation(selectedId)
  }, [selectedId, tick])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, selectedId])

  function chooseUser(id: number) {
    setSelectedId(id)
    setSearchParams({ user: String(id) })
    setError('')
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    if (!selectedId || !draft.trim() || sending) return
    const text = draft.trim()
    setSending(true)
    setError('')
    try {
      const sent = await sendChatMessage(selectedId, text)
      setDraft('')
      setMessages(current => current.some(x => x.id === sent.id) ? current : [...current, sent])
      await loadSidebar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إرسال الرسالة')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="page chat-page">
      <div className="page-head">
        <div>
          <h2>محادثات الفريق</h2>
          <p>تواصل مباشر وآمن بين مستخدمي النظام.</p>
        </div>
      </div>

      <div className="chat-shell">
        <aside className="chat-people-panel">
          <div className="chat-panel-title"><Users size={19} /><div><strong>الفريق</strong><span>{people.length} مستخدم</span></div></div>
          <label className="chat-search"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن موظف..." /></label>
          <div className="chat-people-list">
            {people.length === 0 ? <div className="chat-empty-small">لا يوجد مستخدمون مطابقون.</div> : people.map(person => {
              const conversation = conversationMap.get(person.id)
              return (
                <button key={person.id} className={`chat-person ${selectedId === person.id ? 'active' : ''}`} onClick={() => chooseUser(person.id)}>
                  <span className="chat-avatar">{person.display_name.trim().charAt(0).toUpperCase()}</span>
                  <span className="chat-person-body">
                    <span className="chat-person-top"><strong>{person.display_name}</strong>{conversation && <em>{listTime(conversation.last_message.created_at)}</em>}</span>
                    <small>{conversation ? conversation.last_message.content : person.role}</small>
                  </span>
                  {!!conversation?.unread_count && <span className="chat-unread-badge">{conversation.unread_count > 99 ? '99+' : conversation.unread_count}</span>}
                </button>
              )
            })}
          </div>
        </aside>

        <section className="chat-conversation-panel">
          {!selectedUser ? (
            <div className="chat-welcome"><span className="chat-welcome-icon"><MessageCircle size={34} /></span><h3>اختر شخصًا لبدء المحادثة</h3><p>الرسائل ستظهر هنا فورًا وتصل للطرف الآخر في الوقت الحقيقي.</p></div>
          ) : (
            <>
              <div className="chat-conversation-head">
                <span className="chat-avatar large">{selectedUser.display_name.trim().charAt(0).toUpperCase()}</span>
                <div><strong>{selectedUser.display_name}</strong><span>{selectedUser.role}</span></div>
              </div>

              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="chat-first-message"><MessageCircle size={24} /><strong>ابدأ المحادثة مع {selectedUser.display_name}</strong><span>اكتب أول رسالة من الأسفل.</span></div>
                ) : messages.map(message => {
                  const mine = message.sender_id === user.id
                  return (
                    <div key={message.id} className={`chat-message-row ${mine ? 'mine' : 'theirs'}`}>
                      <div className="chat-bubble">
                        <p>{message.content}</p>
                        <span>{messageTime(message.created_at)}{mine && message.is_read ? ' · تمت القراءة' : ''}</span>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              <form className="chat-composer" onSubmit={submit}>
                {error && <div className="chat-error">{error}</div>}
                <div className="chat-compose-row">
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        submit()
                      }
                    }}
                    maxLength={5000}
                    placeholder={`اكتب رسالة إلى ${selectedUser.display_name}...`}
                  />
                  <button className="chat-send" type="submit" disabled={sending || !draft.trim()} aria-label="إرسال"><Send size={19} /></button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
