import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { addReviewComment, decideReview, getReviewDetail, Review, ReviewComment, User } from '../api'
import { ArrowRight, CheckCircle2, CornerDownLeft, MessageCircle, Reply, ShieldAlert, X, XCircle } from 'lucide-react'
import Toast from '../components/Toast'

function roleLabel(role: string) {
  if (role === 'manager') return 'مدير'
  if (role === 'admin') return 'مدير النظام'
  return 'موظف'
}
function statusLabel(status: string) {
  if (status === 'Approved') return 'معتمد'
  if (status === 'Rejected') return 'مرفوض'
  return 'قيد المراجعة'
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat('ar-EG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export default function ReviewDetails({ user }: { user: User }) {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const targetComment = new URLSearchParams(location.search).get('comment')
  const [review, setReview] = useState<Review | null>(null)
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const commentRefs = useRef<Record<number, HTMLDivElement | null>>({})

  const load = async () => {
    if (!id) return
    try { setLoading(true); setReview(await getReviewDetail(Number(id))) } catch (ex: any) { setToast(ex.message || 'تعذر تحميل التقييم'); setToastError(true) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [id])

  useEffect(() => {
    if (!targetComment || !review) return
    const numeric = Number(targetComment)
    const el = commentRefs.current[numeric]
    if (!el) return
    window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('comment-highlight')
      window.setTimeout(() => el.classList.remove('comment-highlight'), 2200)
    }, 150)
  }, [targetComment, review])

  const flatComments = useMemo(() => review?.comments || [], [review])
  const repliesByParent = useMemo(() => {
    const map = new Map<number, ReviewComment[]>()
    flatComments.forEach(c => { if (c.parent_comment_id) map.set(c.parent_comment_id, [...(map.get(c.parent_comment_id) || []), c]) })
    return map
  }, [flatComments])

  async function submitComment() {
    const text = commentText.trim()
    if (!text || !review) return
    try {
      await addReviewComment(review.id, text, replyTo || undefined)
      setCommentText(''); setReplyTo(null); setToast(replyTo ? 'تم إرسال الرد بنجاح ✓' : 'تم إضافة التعليق بنجاح ✓'); setToastError(false); await load()
    } catch (ex: any) { setToast(ex.message || 'تعذر إضافة التعليق'); setToastError(true) }
  }

  async function approve() {
    if (!review) return
    try { await decideReview(review.id, 'Approved'); setToast('تم اعتماد التقييم بنجاح ✓'); setToastError(false); await load() }
    catch (ex: any) { setToast(ex.message || 'تعذر اعتماد التقييم'); setToastError(true) }
  }

  async function reject() {
    if (!review || !rejectionReason.trim()) return
    try { await decideReview(review.id, 'Rejected', rejectionReason.trim()); setRejectOpen(false); setRejectionReason(''); setToast('تم رفض التقييم وتسجيل سبب الرفض ✓'); setToastError(false); await load() }
    catch (ex: any) { setToast(ex.message || 'تعذر رفض التقييم'); setToastError(true) }
  }

  if (loading) return <section className="page"><div className="detail-loading">جارٍ تحميل تفاصيل التقييم...</div></section>
  if (!review) return <section className="page"><div className="panel"><h3>التقييم غير موجود</h3><button className="btn secondary" onClick={() => navigate('/reviews')}>العودة للتقييمات</button></div></section>

  const canDecide = (user.role === 'manager' || user.role === 'admin') && review.status === 'Pending'

  return (
    <section className="page">
      <div className="page-head">
        <div><button className="back-link no-print" onClick={() => navigate('/reviews')}><ArrowRight size={17} /> العودة للتقييمات</button><h2>تفاصيل التقييم #{review.id}</h2><p>{review.hotel_name} · الحجز {review.booking_number} · {review.employee_name}</p></div>
      </div>

      <div className="review-detail-grid">
        <div className="panel review-info-card">
          <div className="detail-header"><div><h3>معلومات التقييم</h3><span>{review.platform_name}</span></div><span className={`status-badge ${review.status.toLowerCase()}`}>{statusLabel(review.status)}</span></div>
          <div className="detail-facts">
            <div><small>الفندق</small><strong>{review.hotel_name}</strong></div><div><small>رقم الحجز</small><strong>{review.booking_number}</strong></div>
            <div><small>التقييم</small><strong>{review.rating}/10</strong></div><div><small>المشاعر</small><strong>{review.sentiment}</strong></div>
            <div><small>تاريخ التقييم</small><strong>{review.review_date}</strong></div><div><small>الموظف</small><strong>{review.employee_name}</strong></div>
          </div>
          <div className="detail-text-block"><small>التعليق الأصلي</small><p>{review.comment || 'لا يوجد تعليق أصلي.'}</p></div>
          <div className="detail-text-block"><small>الإجراء المقترح</small><p>{review.proposed_action || 'لم يتم تحديد إجراء مقترح.'}</p></div>
          {review.status === 'Rejected' && <div className="rejection-box"><div><ShieldAlert size={18} /><strong>سبب الرفض</strong></div><p>{review.rejection_reason || 'لم يتم تسجيل سبب الرفض.'}</p></div>}
          {canDecide && <div className="decision-actions no-print"><button className="btn primary decision-approve" onClick={approve}><CheckCircle2 size={18} /> اعتماد التقييم</button><button className="btn danger" onClick={() => setRejectOpen(true)}><XCircle size={18} /> رفض التقييم</button></div>}
        </div>

        <div className="panel conversation-card">
          <div className="detail-header"><div><h3>المحادثة</h3><span>{flatComments.length} تعليق</span></div><MessageCircle size={21} /></div>
          <div className="conversation-list">
            {flatComments.length === 0 ? <div className="conversation-empty">لا توجد تعليقات إضافية حتى الآن.</div> : flatComments.map(c => (
              <div key={c.id} ref={el => { commentRefs.current[c.id] = el }} className={`conversation-item ${c.parent_comment_id ? 'reply' : ''} ${c.unread ? 'unread-comment' : ''}`}>
                <div className="conversation-meta"><div><strong>{c.author_name}</strong><span>{roleLabel(c.author_role)}</span></div><time>{formatDate(c.created_at)}</time></div>
                {c.parent_comment_id && <div className="reply-context"><CornerDownLeft size={14} /> رد على تعليق #{c.parent_comment_id}</div>}
                <p>{c.content}</p>
                <div className="conversation-actions no-print"><button className="reply-btn" onClick={() => { setReplyTo(c.id); setCommentText('') }}><Reply size={14} /> رد</button></div>
              </div>
            ))}
          </div>
          <div className="comment-composer no-print">
            <div className="composer-head"><div><strong>{replyTo ? `رد على التعليق #${replyTo}` : 'إضافة تعليق'}</strong><span>المحادثة متاحة للموظف والمدير حسب الصلاحيات.</span></div>{replyTo && <button className="composer-cancel" onClick={() => setReplyTo(null)}><X size={16} /> إلغاء الرد</button>}</div>
            <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder={replyTo ? 'اكتب الرد...' : 'اكتب تعليقك...'} rows={4} />
            <button className="btn primary" onClick={submitComment} disabled={!commentText.trim()}>{replyTo ? 'إرسال الرد' : 'إضافة التعليق'}</button>
          </div>
        </div>
      </div>

      {rejectOpen && <div className="modal-backdrop" onClick={() => setRejectOpen(false)}><div className="modal-card rejection-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div><h3>رفض التقييم</h3><p>يرجى توضيح سبب رفض التقييم.</p></div><button className="modal-close" onClick={() => setRejectOpen(false)}><X /></button></div>
        <label className="modal-single-label">سبب الرفض<textarea required autoFocus placeholder="اكتب سبب رفض التقييم..." value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={5} /></label>
        <div className="modal-actions"><button className="btn secondary" onClick={() => setRejectOpen(false)}>إلغاء</button><button className="btn danger" disabled={!rejectionReason.trim()} onClick={reject}>تأكيد الرفض</button></div>
      </div></div>}
      {toast && <Toast text={toast} error={toastError} onClose={() => setToast('')} />}
    </section>
  )
}
