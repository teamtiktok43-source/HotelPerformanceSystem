import { useEffect, useMemo, useState } from 'react'
import {
  deleteBooking,
  deleteRevenue,
  deleteReview,
  getData,
  getEmployees,
  getHotels,
  updateBooking,
  updateRevenue,
  updateReview,
} from '../api'
import { getAuthUser } from '../api'
import { useRealtime } from '../useRealtime'

const dateValue = (value: any) => String(value || '').slice(0, 10)
const money = (value: any) => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '0.00'

export default function Data() {
  const tick = useRealtime()
  const user = getAuthUser()
  const canManage = user?.role === 'admin' || user?.role === 'manager'
  const [d, setD] = useState<any>({ bookings: [], revenues: [], reviews: [] })
  const [hotels, setHotels] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [editing, setEditing] = useState<{ type: 'booking' | 'revenue' | 'review'; row: any } | null>(null)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const refresh = async () => {
    const result = await getData()
    setD(result || { bookings: [], revenues: [], reviews: [] })
  }

  useEffect(() => {
    Promise.all([refresh(), getHotels(), getEmployees()]).then(([, hs, es]) => {
      setHotels(Array.isArray(hs) ? hs : [])
      setEmployees(Array.isArray(es) ? es : [])
    }).catch(() => {})
  }, [tick])

  const hotelOptions = useMemo(() => hotels.filter(h => h.active !== false), [hotels])
  const employeeOptions = useMemo(() => employees.filter(e => e.active !== false), [employees])

  const openEdit = (type: 'booking' | 'revenue' | 'review', row: any) => {
    setEditing({ type, row })
    if (type === 'booking') {
      setForm({
        hotel_id: String(row.hotel_id ?? ''),
        booking_date: dateValue(row.booking_date),
        total_bookings: row.total_bookings ?? 0,
        paid_bookings: row.paid_bookings ?? 0,
        employee_id: String(row.employee_id ?? ''),
      })
    } else if (type === 'revenue') {
      setForm({
        booking_number: row.booking_number ?? '',
        hotel_id: String(row.hotel_id ?? ''),
        platform: row.platform ?? 'Booking.com',
        revenue_date: dateValue(row.revenue_date),
        actual_price: row.actual_price ?? 0,
        commissionable_amount: row.commissionable_amount ?? 0,
        employee_id: String(row.employee_id ?? ''),
      })
    } else {
      setForm({
        booking_number: row.booking_number ?? '',
        hotel_id: String(row.hotel_id ?? ''),
        rating: row.rating ?? 0,
        comment: row.comment ?? '',
        sentiment: row.sentiment ?? 'Positive',
        review_date: dateValue(row.review_date),
        proposed_action: row.proposed_action ?? '',
        employee_id: String(row.employee_id ?? ''),
      })
    }
  }

  const closeEdit = () => {
    if (saving) return
    setEditing(null)
    setForm({})
  }

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    try {
      if (editing.type === 'booking') {
        await updateBooking(editing.row.id, {
          hotel_id: Number(form.hotel_id),
          booking_date: form.booking_date,
          total_bookings: Number(form.total_bookings),
          paid_bookings: Number(form.paid_bookings),
          employee_id: Number(form.employee_id),
        })
      } else if (editing.type === 'revenue') {
        await updateRevenue(editing.row.id, {
          booking_number: String(form.booking_number),
          hotel_id: Number(form.hotel_id),
          platform: String(form.platform),
          revenue_date: form.revenue_date,
          actual_price: Number(form.actual_price),
          commissionable_amount: Number(form.commissionable_amount),
          employee_id: Number(form.employee_id),
        })
      } else {
        await updateReview(editing.row.id, {
          booking_number: String(form.booking_number),
          hotel_id: Number(form.hotel_id),
          rating: Number(form.rating),
          comment: String(form.comment),
          sentiment: String(form.sentiment),
          review_date: form.review_date,
          proposed_action: String(form.proposed_action),
          employee_id: Number(form.employee_id),
        })
      }
      await refresh()
      closeEdit()
    } catch (error: any) {
      window.alert(error?.message || 'تعذر حفظ التعديل')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (type: 'booking' | 'revenue' | 'review', row: any) => {
    const title = type === 'booking' ? 'الحجز' : type === 'revenue' ? 'الإيراد' : 'التقييم'
    if (!window.confirm(`هل أنت متأكد من حذف ${title}؟\nهذا الإجراء لا يمكن التراجع عنه.`)) return
    try {
      if (type === 'booking') await deleteBooking(row.id)
      if (type === 'revenue') await deleteRevenue(row.id)
      if (type === 'review') await deleteReview(row.id)
      await refresh()
    } catch (error: any) {
      window.alert(error?.message || 'تعذر الحذف')
    }
  }

  const update = (key: string, value: any) => setForm((prev: any) => ({ ...prev, [key]: value }))

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>البيانات</h2>
          <p>عرض مركزي لكل السجلات المحفوظة من كل الأجهزة.</p>
        </div>
        <button className="btn secondary no-print" onClick={refresh}>تحديث البيانات</button>
      </div>

      {!canManage && <div className="panel no-print inline-msg">العرض متاح لجميع المستخدمين، أما التعديل والحذف فمتاحان للمدير فقط.</div>}

      <div className="panel">
        <h3>الحجوزات ({d.bookings.length})</h3>
        <div className="table-wrap"><table><thead><tr><th>التاريخ</th><th>الفندق</th><th>الإجمالي</th><th>مدفوع</th><th>كاش</th><th>الموظف</th>{canManage && <th>إجراء</th>}</tr></thead>
          <tbody>{d.bookings.length ? d.bookings.map((r: any) => <tr key={r.id}><td>{r.booking_date}</td><td>{r.hotel_name}</td><td>{r.total_bookings}</td><td>{r.paid_bookings}</td><td>{r.cash_bookings}</td><td>{r.employee_name}</td>{canManage && <td><div className="action-row"><button className="mini" onClick={() => openEdit('booking', r)}>تعديل</button><button className="mini mini-danger" onClick={() => remove('booking', r)}>حذف</button></div></td>}</tr>) : <tr><td colSpan={canManage ? 7 : 6} className="empty-cell">لا توجد حجوزات.</td></tr>}</tbody>
        </table></div>
      </div>

      <div className="panel">
        <h3>الإيرادات ({d.revenues.length})</h3>
        <div className="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحجز</th><th>الفندق</th><th>المنصة</th><th>الفعلي</th><th>العمولة</th><th>الصافي</th><th>الموظف</th>{canManage && <th>إجراء</th>}</tr></thead>
          <tbody>{d.revenues.length ? d.revenues.map((r: any) => <tr key={r.id}><td>{r.revenue_date}</td><td>{r.booking_number}</td><td>{r.hotel_name}</td><td>{r.platform}</td><td>{money(r.actual_price)}</td><td>{money(r.commission)}</td><td>{money(r.net_revenue)}</td><td>{r.employee_name}</td>{canManage && <td><div className="action-row"><button className="mini" onClick={() => openEdit('revenue', r)}>تعديل</button><button className="mini mini-danger" onClick={() => remove('revenue', r)}>حذف</button></div></td>}</tr>) : <tr><td colSpan={canManage ? 9 : 8} className="empty-cell">لا توجد إيرادات.</td></tr>}</tbody>
        </table></div>
      </div>

      <div className="panel">
        <h3>التقييمات ({d.reviews.length})</h3>
        <div className="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحجز</th><th>الفندق</th><th>التقييم</th><th>المشاعر</th><th>الحالة</th><th>الموظف</th>{canManage && <th>إجراء</th>}</tr></thead>
          <tbody>{d.reviews.length ? d.reviews.map((r: any) => <tr key={r.id}><td>{r.review_date}</td><td>{r.booking_number}</td><td>{r.hotel_name}</td><td>{r.rating}</td><td>{r.sentiment}</td><td>{r.status}</td><td>{r.employee_name}</td>{canManage && <td><div className="action-row"><button className="mini" onClick={() => openEdit('review', r)}>تعديل</button><button className="mini mini-danger" onClick={() => remove('review', r)}>حذف</button></div></td>}</tr>) : <tr><td colSpan={canManage ? 8 : 7} className="empty-cell">لا توجد تقييمات.</td></tr>}</tbody>
        </table></div>
      </div>

      {editing && (
        <div className="modal-backdrop no-print" onMouseDown={e => { if (e.target === e.currentTarget) closeEdit() }}>
          <div className="modal-card" dir="rtl">
            <div className="modal-head"><div><h3>تعديل {editing.type === 'booking' ? 'الحجز' : editing.type === 'revenue' ? 'الإيراد' : 'التقييم'}</h3><p>تعديل السجل مباشرة في قاعدة البيانات.</p></div><button className="modal-close" onClick={closeEdit}>×</button></div>

            {editing.type === 'booking' && <div className="form-grid modal-grid">
              <label>الفندق<select value={form.hotel_id} onChange={e => update('hotel_id', e.target.value)}>{hotelOptions.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
              <label>التاريخ<input type="date" value={form.booking_date} onChange={e => update('booking_date', e.target.value)} /></label>
              <label>إجمالي الحجوزات<input type="number" min="0" value={form.total_bookings} onChange={e => update('total_bookings', e.target.value)} /></label>
              <label>الحجوزات المدفوعة<input type="number" min="0" value={form.paid_bookings} onChange={e => update('paid_bookings', e.target.value)} /></label>
              <label>الموظف<select value={form.employee_id} onChange={e => update('employee_id', e.target.value)}>{employeeOptions.map(e => <option key={e.id} value={e.id}>{e.display_name}</option>)}</select></label>
            </div>}

            {editing.type === 'revenue' && <div className="form-grid modal-grid">
              <label>رقم الحجز<input value={form.booking_number} onChange={e => update('booking_number', e.target.value)} /></label>
              <label>الفندق<select value={form.hotel_id} onChange={e => update('hotel_id', e.target.value)}>{hotelOptions.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
              <label>المنصة<input value={form.platform} onChange={e => update('platform', e.target.value)} /></label>
              <label>تاريخ الإيراد<input type="date" value={form.revenue_date} onChange={e => update('revenue_date', e.target.value)} /></label>
              <label>السعر الفعلي<input type="number" min="0" step="0.01" value={form.actual_price} onChange={e => update('actual_price', e.target.value)} /></label>
              <label>المبلغ الخاضع للعمولة<input type="number" min="0" step="0.01" value={form.commissionable_amount} onChange={e => update('commissionable_amount', e.target.value)} /></label>
              <label>الموظف<select value={form.employee_id} onChange={e => update('employee_id', e.target.value)}>{employeeOptions.map(e => <option key={e.id} value={e.id}>{e.display_name}</option>)}</select></label>
            </div>}

            {editing.type === 'review' && <div className="form-grid modal-grid">
              <label>رقم الحجز<input value={form.booking_number} onChange={e => update('booking_number', e.target.value)} /></label>
              <label>الفندق<select value={form.hotel_id} onChange={e => update('hotel_id', e.target.value)}>{hotelOptions.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
              <label>التقييم<input type="number" min="0" max="10" step="0.1" value={form.rating} onChange={e => update('rating', e.target.value)} /></label>
              <label>المشاعر<select value={form.sentiment} onChange={e => update('sentiment', e.target.value)}><option value="Positive">Positive</option><option value="Negative">Negative</option><option value="Neutral">Neutral</option></select></label>
              <label>تاريخ التقييم<input type="date" value={form.review_date} onChange={e => update('review_date', e.target.value)} /></label>
              <label>الموظف<select value={form.employee_id} onChange={e => update('employee_id', e.target.value)}>{employeeOptions.map(e => <option key={e.id} value={e.id}>{e.display_name}</option>)}</select></label>
              <label className="span-2">التعليق<textarea value={form.comment} onChange={e => update('comment', e.target.value)} /></label>
              <label className="span-2">الإجراء المقترح<textarea value={form.proposed_action} onChange={e => update('proposed_action', e.target.value)} /></label>
            </div>}

            <div className="modal-actions"><button className="btn secondary" onClick={closeEdit} disabled={saving}>إلغاء</button><button className="btn primary" onClick={saveEdit} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ التعديل'}</button></div>
          </div>
        </div>
      )}
    </section>
  )
}
