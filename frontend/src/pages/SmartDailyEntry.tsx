import { FormEvent, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Hotel as HotelIcon, Plus, Sparkles, Star, Trash2, WalletCards } from 'lucide-react'
import {
  createSmartEntry,
  getAuthUser,
  getEmployees,
  getHotels,
  getLocalDateString,
  getPlatforms,
  Hotel,
  Platform,
  SmartEntryItemInput,
  User,
} from '../api'
import Toast from '../components/Toast'
import { useEffect } from 'react'

type DraftRow = {
  id: string
  booking_number: string
  payment_status: 'Paid' | 'Cash'
  platform_id: string
  actual_price: string
  commissionable_amount: string
  has_review: boolean
  rating: string
  sentiment: 'Positive' | 'Negative' | 'Neutral'
  comment: string
  proposed_action: string
}

const newRow = (): DraftRow => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  booking_number: '',
  payment_status: 'Paid',
  platform_id: '',
  actual_price: '',
  commissionable_amount: '',
  has_review: false,
  rating: '5',
  sentiment: 'Positive',
  comment: '',
  proposed_action: '',
})

const n = (value: string | number | undefined | null) => {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function SmartDailyEntry({ user }: { user: User }) {
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [employees, setEmployees] = useState<User[]>([])
  const [hotelId, setHotelId] = useState('')
  const [entryDate, setEntryDate] = useState(getLocalDateString())
  const [employeeId, setEmployeeId] = useState('')
  const [rows, setRows] = useState<DraftRow[]>([newRow()])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState(false)
  const [lastResult, setLastResult] = useState<string>('')

  useEffect(() => {
    Promise.all([getHotels(), getPlatforms(), getEmployees()])
      .then(([h, p, e]) => {
        setHotels(h)
        setPlatforms(p)
        setEmployees(e)
      })
      .catch((ex: any) => {
        setToast(ex?.message || 'تعذر تحميل بيانات الإدخال الذكي')
        setError(true)
      })
  }, [])

  const selectedHotel = hotels.find(h => String(h.id) === hotelId)
  const commissionRate = n(selectedHotel?.commission_rate)
  const taxRate = n(selectedHotel?.tax_rate)

  const summary = useMemo(() => {
    const paid = rows.filter(r => r.payment_status === 'Paid').length
    const cash = rows.filter(r => r.payment_status === 'Cash').length
    const total = rows.reduce((sum, r) => sum + n(r.actual_price), 0)
    const commission = rows.reduce((sum, r) => {
      const base = r.commissionable_amount === '' ? n(r.actual_price) : n(r.commissionable_amount)
      return sum + base * commissionRate
    }, 0)
    const tax = total * taxRate
    return {
      totalRows: rows.length,
      paid,
      cash,
      total,
      commission,
      tax,
      net: total - commission - tax,
      reviews: rows.filter(r => r.has_review).length,
    }
  }, [rows, commissionRate, taxRate])

  function patchRow(id: string, patch: Partial<DraftRow>) {
    setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row))
  }

  function addRow() {
    setRows(current => [...current, newRow()])
  }

  function removeRow(id: string) {
    setRows(current => current.length === 1 ? current : current.filter(row => row.id !== id))
  }

  function validate() {
    if (!hotelId) return 'اختر الفندق أولًا.'
    if (!entryDate) return 'اختر تاريخ الإدخال.'
    const numbers = new Set<string>()
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]
      const label = `الحجز رقم ${i + 1}`
      const bookingNumber = row.booking_number.trim()
      if (!bookingNumber) return `${label}: أدخل رقم الحجز.`
      const normalized = bookingNumber.toLowerCase()
      if (numbers.has(normalized)) return `${label}: رقم الحجز مكرر داخل نفس الدفعة.`
      numbers.add(normalized)
      if (!row.platform_id) return `${label}: اختر المنصة.`
      if (row.actual_price === '' || n(row.actual_price) < 0) return `${label}: أدخل السعر الإجمالي.`
      if (row.commissionable_amount !== '' && n(row.commissionable_amount) < 0) return `${label}: المبلغ الخاضع للعمولة غير صحيح.`
      if (row.has_review) {
        if (!row.comment.trim()) return `${label}: التعليق مطلوب عند إضافة تقييم.`
        if (n(row.rating) < 0 || n(row.rating) > 10) return `${label}: التقييم يجب أن يكون من 0 إلى 10.`
      }
    }
    return ''
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const validation = validate()
    if (validation) {
      setToast(validation)
      setError(true)
      return
    }

    const items: SmartEntryItemInput[] = rows.map(row => ({
      booking_number: row.booking_number.trim(),
      payment_status: row.payment_status,
      platform_id: Number(row.platform_id),
      actual_price: n(row.actual_price),
      commissionable_amount: row.commissionable_amount === '' ? n(row.actual_price) : n(row.commissionable_amount),
      review: row.has_review ? {
        rating: n(row.rating),
        comment: row.comment.trim(),
        sentiment: row.sentiment,
        proposed_action: row.proposed_action.trim(),
      } : null,
    }))

    setSaving(true)
    try {
      const result = await createSmartEntry({
        hotel_id: Number(hotelId),
        entry_date: entryDate,
        employee_id: employeeId ? Number(employeeId) : undefined,
        items,
      })
      setError(false)
      setToast(`تم توزيع ${result.reservations} حجز بنجاح على الحجوزات والإيرادات${result.review_records ? ` و${result.review_records} تقييم` : ''}.`)
      setLastResult(`تم الحفظ: ${result.reservations} حجز • ${result.paid_bookings} مدفوع • ${result.cash_bookings} كاش • ${result.revenue_records} إيراد • ${result.review_records} تقييم`)
      setRows([newRow()])
    } catch (ex: any) {
      setToast(ex?.message || 'تعذر حفظ الإدخال الذكي')
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="page smart-entry-page">
      <div className="page-head">
        <div>
          <div className="smart-entry-eyebrow"><Sparkles size={15} /> SMART DAILY ENTRY</div>
          <h2>الإدخال اليومي الذكي</h2>
          <p>أدخل كل حجز مرة واحدة، والنظام يجمع الحجوزات ويوزع الإيرادات والتقييمات تلقائيًا في أماكنها الصحيحة.</p>
        </div>
      </div>

      <form onSubmit={save}>
        <div className="smart-entry-context panel no-print">
          <div className="smart-entry-context-head">
            <div><strong>بيانات الدفعة</strong><span>الفندق والتاريخ يطبقان على كل الحجوزات الموجودة بالأسفل.</span></div>
            <Sparkles size={22} />
          </div>
          <div className="smart-entry-context-grid">
            <label><span><HotelIcon size={16} /> الفندق</span><select required value={hotelId} onChange={e => setHotelId(e.target.value)}><option value="">اختر الفندق</option>{hotels.filter(h => h.active).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
            <label><span><CalendarDays size={16} /> تاريخ الإدخال</span><input type="date" required value={entryDate} onChange={e => setEntryDate(e.target.value)} /></label>
            <label><span>الموظف</span><select value={employeeId} onChange={e => setEmployeeId(e.target.value)} disabled={!['admin', 'manager'].includes(user.role)}><option value="">أنا ({getAuthUser()?.display_name || user.display_name})</option>{['admin', 'manager'].includes(user.role) && employees.filter(e => e.active && e.id !== user.id).map(e => <option key={e.id} value={e.id}>{e.display_name}</option>)}</select></label>
          </div>
        </div>

        <div className="smart-summary-grid no-print">
          <div className="smart-summary-card"><span>إجمالي الحجوزات</span><strong>{summary.totalRows}</strong><small>صفوف الحجز الحالية</small></div>
          <div className="smart-summary-card paid"><span>مدفوع</span><strong>{summary.paid}</strong><small>يتجمع تلقائيًا</small></div>
          <div className="smart-summary-card cash"><span>كاش</span><strong>{summary.cash}</strong><small>يتجمع تلقائيًا</small></div>
          <div className="smart-summary-card"><span>إجمالي السعر</span><strong>{summary.total.toFixed(2)}</strong><small>إجمالي كل الحجوزات</small></div>
          <div className="smart-summary-card"><span>صافي الإيراد المتوقع</span><strong>{summary.net.toFixed(2)}</strong><small>بعد العمولة والضريبة</small></div>
          <div className="smart-summary-card review"><span>التقييمات</span><strong>{summary.reviews}</strong><small>اختيارية لكل حجز</small></div>
        </div>

        <div className="smart-entry-list no-print">
          {rows.map((row, index) => {
            const platform = platforms.find(p => String(p.id) === row.platform_id)
            const commissionable = row.commissionable_amount === '' ? n(row.actual_price) : n(row.commissionable_amount)
            const commission = commissionable * commissionRate
            const tax = n(row.actual_price) * taxRate
            const net = n(row.actual_price) - commission - tax
            return (
              <article className="smart-booking-card" key={row.id}>
                <div className="smart-booking-head">
                  <div className="smart-booking-number"><span>{index + 1}</span><div><strong>حجز جديد</strong><small>{row.booking_number || 'أدخل رقم الحجز'}</small></div></div>
                  <div className="smart-booking-actions">
                    <span className={`smart-payment-chip ${row.payment_status.toLowerCase()}`}>{row.payment_status === 'Paid' ? 'مدفوع' : 'كاش'}</span>
                    <button type="button" className="smart-remove-btn" onClick={() => removeRow(row.id)} disabled={rows.length === 1} title="حذف الحجز"><Trash2 size={17} /></button>
                  </div>
                </div>

                <div className="smart-row-grid">
                  <label>رقم الحجز<input value={row.booking_number} onChange={e => patchRow(row.id, { booking_number: e.target.value })} placeholder="مثال: 5413062694" /></label>
                  <label>الحالة<select value={row.payment_status} onChange={e => patchRow(row.id, { payment_status: e.target.value as 'Paid' | 'Cash' })}><option value="Paid">مدفوع</option><option value="Cash">كاش</option></select></label>
                  <label>المنصة<select value={row.platform_id} onChange={e => patchRow(row.id, { platform_id: e.target.value })}><option value="">اختر المنصة</option>{platforms.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                  <label>السعر الإجمالي<input type="number" min="0" step="0.01" value={row.actual_price} onChange={e => patchRow(row.id, { actual_price: e.target.value })} placeholder="0.00" /></label>
                  <label>الخاضع للعمولة<input type="number" min="0" step="0.01" value={row.commissionable_amount} onChange={e => patchRow(row.id, { commissionable_amount: e.target.value })} placeholder={row.actual_price || 'نفس السعر تلقائيًا'} /></label>
                </div>

                <div className="smart-finance-strip">
                  <span><WalletCards size={15} /> {platform?.name || 'لم تُحدد المنصة'}</span>
                  <span>العمولة {(commissionRate * 100).toFixed(2)}% = <b>{commission.toFixed(2)}</b></span>
                  <span>الضريبة {(taxRate * 100).toFixed(2)}% = <b>{tax.toFixed(2)}</b></span>
                  <span>الصافي <b>{net.toFixed(2)}</b></span>
                </div>

                <div className={`smart-review-box ${row.has_review ? 'open' : ''}`}>
                  <label className="smart-review-toggle">
                    <input type="checkbox" checked={row.has_review} onChange={e => patchRow(row.id, { has_review: e.target.checked })} />
                    <span><Star size={17} /> إضافة تقييم / مراجعة لهذا الحجز</span>
                  </label>
                  {row.has_review && (
                    <div className="smart-review-grid">
                      <label>التقييم<input type="number" min="0" max="10" step="0.1" value={row.rating} onChange={e => patchRow(row.id, { rating: e.target.value })} /></label>
                      <label>المشاعر<select value={row.sentiment} onChange={e => patchRow(row.id, { sentiment: e.target.value as DraftRow['sentiment'] })}><option value="Positive">Positive</option><option value="Negative">Negative</option><option value="Neutral">Neutral</option></select></label>
                      <label className="span-2">التعليق<textarea value={row.comment} onChange={e => patchRow(row.id, { comment: e.target.value })} placeholder="اكتب تعليق النزيل أو ملخص المراجعة" /></label>
                      <label className="span-2">الإجراء المقترح<textarea value={row.proposed_action} onChange={e => patchRow(row.id, { proposed_action: e.target.value })} placeholder="رأينا أو الإجراء المقترح للفندق" /></label>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        <div className="smart-entry-footer no-print">
          <button type="button" className="btn secondary smart-add-btn" onClick={addRow}><Plus size={18} /> إضافة حجز آخر</button>
          <div className="smart-save-side">
            {lastResult && <span className="smart-last-result"><CheckCircle2 size={16} /> {lastResult}</span>}
            <button className="btn primary smart-save-btn" disabled={saving}>{saving ? 'جاري الحفظ والتوزيع...' : 'حفظ وتوزيع البيانات'}</button>
          </div>
        </div>
      </form>

      <div className="smart-entry-note panel">
        <CheckCircle2 size={20} />
        <div><strong>كيف يعمل التوزيع؟</strong><p>كل صف ينشئ إيرادًا مستقلًا برقم الحجز، ويتم تجميع المدفوع والكاش تلقائيًا في الحجوزات اليومية حسب المنصة. وإذا فعّلت التقييم، يُنشأ تقييم «قيد المراجعة» لنفس رقم الحجز.</p></div>
      </div>

      {toast && <Toast text={toast} error={error} onClose={() => setToast('')} />}
    </section>
  )
}
