import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createReview, getEmployees, getHotels, getPlatforms, getReviews, getLocalDateString, Hotel, Platform, Review, User } from '../api'
import PrintButton from '../components/PrintButton'
import { useRealtime } from '../useRealtime'
import { Eye, MessageCircle, ShieldCheck } from 'lucide-react'
import Toast from '../components/Toast'

function statusLabel(status: string) {
  if (status === 'Approved') return 'معتمد'
  if (status === 'Rejected') return 'مرفوض'
  return 'قيد المراجعة'
}

export default function Reviews({ user }: { user: User }) {
  const navigate = useNavigate()
  const tick = useRealtime()
  const today = getLocalDateString()
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [emps, setEmps] = useState<User[]>([])
  const [rows, setRows] = useState<Review[]>([])
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [hotelFilter, setHotelFilter] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [form, setForm] = useState({ booking_number: '', hotel_id: '', platform_id: '', rating: '5', comment: '', sentiment: 'Positive', review_date: today, proposed_action: '', employee_id: '' })
  const [toast, setToast] = useState('')
  const [error, setError] = useState(false)

  const load = () => {
    const params = new URLSearchParams()
    if (start) params.set('start', start)
    if (end) params.set('end', end)
    if (hotelFilter) params.set('hotel_id', hotelFilter)
    if (platformFilter) params.set('platform_id', platformFilter)
    if (statusFilter) params.set('status', statusFilter)
    return getReviews(params.toString()).then(setRows).catch((ex: any) => { setToast(ex?.message || 'تعذر تحميل التقييمات'); setError(true) })
  }
  useEffect(() => { Promise.all([getHotels(), getEmployees(), getPlatforms()]).then(([h, e, p]) => { setHotels(h); setEmps(e); setPlatforms(p) }).catch(() => { setToast('تعذر تحميل بيانات النموذج'); setError(true) }) }, [])
  useEffect(() => { load() }, [tick, start, end, hotelFilter, platformFilter, statusFilter])

  async function save(e: FormEvent) {
    e.preventDefault()
    try {
      await createReview({ ...form, hotel_id: Number(form.hotel_id), platform_id: form.platform_id ? Number(form.platform_id) : undefined, rating: Number(form.rating), employee_id: form.employee_id ? Number(form.employee_id) : undefined })
      setToast('تم حفظ التقييم وإرساله للمراجعة ✓')
      setError(false)
      setForm({ ...form, booking_number: '', comment: '', proposed_action: '' })
      load()
    } catch (ex: any) { setToast(ex.message || 'تعذر حفظ التقييم'); setError(true) }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div><h2>إدارة التقييمات والمراجعات</h2><p>سجل التقييمات، المحادثات، وحالات اعتماد المدير في مساحة واحدة.</p></div>
        <div className="actions no-print"><PrintButton /></div>
      </div>

      <form className="form-card no-print" onSubmit={save}>
        <div className="form-card-title"><div><strong>إضافة تقييم</strong><span>يبدأ التقييم بالحالة «قيد المراجعة» ويمكن استكمال النقاش من صفحة التفاصيل.</span></div><ShieldCheck size={22} /></div>
        <div className="form-grid">
          <label>رقم الحجز<input required value={form.booking_number} onChange={e => setForm({ ...form, booking_number: e.target.value })} /></label>
          <label>الفندق<select required value={form.hotel_id} onChange={e => setForm({ ...form, hotel_id: e.target.value })}><option value="">اختر الفندق</option>{hotels.filter(h => h.active).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
          <label>المنصة<select required value={form.platform_id} onChange={e => setForm({ ...form, platform_id: e.target.value })}><option value="">اختر المنصة</option>{platforms.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>التقييم<input type="number" min="0" max="10" step="0.1" value={form.rating} onChange={e => setForm({ ...form, rating: e.target.value })} /></label>
          <label>المشاعر<select value={form.sentiment} onChange={e => setForm({ ...form, sentiment: e.target.value })}><option>Positive</option><option>Negative</option><option>Neutral</option></select></label>
          <label>تاريخ التقييم<input type="date" value={form.review_date} onChange={e => setForm({ ...form, review_date: e.target.value })} /></label>
          <label>الموظف<select value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}><option value="">أنا</option>{emps.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.display_name}</option>)}</select></label>
          <label className="span-2">التعليق الأصلي<textarea required value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} /></label>
          <label className="span-2">الإجراء المقترح<textarea value={form.proposed_action} onChange={e => setForm({ ...form, proposed_action: e.target.value })} /></label>
        </div>
        <button className="btn primary">حفظ التقييم</button>
      </form>

      <div className="filters no-print">
        <label>من<input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
        <label>إلى<input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>
        <label>الفندق<select value={hotelFilter} onChange={e => setHotelFilter(e.target.value)}><option value="">كل الفنادق</option>{hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
        <label>المنصة<select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}><option value="">كل المنصات</option>{platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>الحالة<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">كل الحالات</option><option value="Pending">قيد المراجعة</option><option value="Approved">معتمد</option><option value="Rejected">مرفوض</option></select></label>
        <button className="btn secondary" onClick={() => load()}>عرض</button>
      </div>

      <div className="panel print-friendly">
        <div className="section-toolbar"><div><h3>سجل التقييمات</h3><span>{rows.length} تقييم</span></div><span className="section-note">افتح التفاصيل لإدارة المحادثة والقرار</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>التاريخ</th><th>الحجز</th><th>الفندق</th><th>المنصة</th><th>التقييم</th><th>المشاعر</th><th>الموظف</th><th>الحالة</th><th>المحادثة</th><th className="no-print">إجراء</th></tr></thead>
            <tbody>
              {rows.length ? rows.map(r => (
                <tr key={r.id} className={r.unread_comment_count ? 'row-unread' : ''} onDoubleClick={() => navigate(`/reviews/${r.id}`)}>
                  <td>{r.review_date}</td><td>{r.booking_number}</td><td>{r.hotel_name}</td><td>{r.platform_name}</td><td>{r.rating}</td><td>{r.sentiment}</td><td>{r.employee_name}</td>
                  <td><span className={`status ${r.status.toLowerCase()}`}>{statusLabel(r.status)}</span></td>
                  <td>{r.unread_comment_count ? <span className="comment-indicator"><span>●</span> تعليق جديد {r.unread_comment_count}</span> : <span className="muted-inline"><MessageCircle size={15} /> محادثة</span>}</td>
                  <td className="no-print"><button className="mini primary-mini" onClick={() => navigate(`/reviews/${r.id}`)}><Eye size={15} /> عرض التفاصيل</button></td>
                </tr>
              )) : <tr><td colSpan={10} className="empty-cell">لا توجد تقييمات متاحة لهذا المستخدم حاليًا.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {toast && <Toast text={toast} error={error} onClose={() => setToast('')} />}
    </section>
  )
}
