import { FormEvent, useEffect, useState } from 'react'
import { createBooking, getBookings, getEmployees, getHotels, getPlatforms, Hotel, User, Platform } from '../api'
import PrintButton from '../components/PrintButton'
import { useRealtime } from '../useRealtime'

export default function DailyBookings() {
  const tick = useRealtime()
  const today = new Date().toISOString().slice(0, 10)
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [emps, setEmps] = useState<User[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [form, setForm] = useState({ hotel_id: '', platform_id: '', booking_date: today, total_bookings: '', paid_bookings: '', employee_id: '' })
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(today)
  const [hotelFilter, setHotelFilter] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [msg, setMsg] = useState('')

  const load = () => getBookings(new URLSearchParams({ start, end, ...(hotelFilter ? { hotel_id: hotelFilter } : {}), ...(platformFilter ? { platform_id: platformFilter } : {}) } as any).toString()).then(setRows)
  useEffect(() => { getHotels().then(setHotels); getEmployees().then(setEmps); getPlatforms().then(setPlatforms) }, [])
  useEffect(() => { load() }, [tick])

  const cash = Math.max(0, Number(form.total_bookings || 0) - Number(form.paid_bookings || 0))

  async function save(e: FormEvent) {
    e.preventDefault()
    try {
      await createBooking({ hotel_id: Number(form.hotel_id), platform_id: form.platform_id ? Number(form.platform_id) : undefined, booking_date: form.booking_date, total_bookings: Number(form.total_bookings), paid_bookings: Number(form.paid_bookings), employee_id: form.employee_id ? Number(form.employee_id) : undefined })
      setMsg('تم حفظ الحجز بنجاح')
      setForm({ ...form, total_bookings: '', paid_bookings: '' })
      load()
    } catch (ex: any) { setMsg(ex.message) }
  }

  return <section className="page">
    <div className="page-head"><div><h2>الحجوزات اليومية</h2><p>إدخال الحجوزات وحساب الكاش تلقائيًا مع تحديد المنصة.</p></div><div className="actions no-print"><PrintButton /></div></div>
    <form className="form-card no-print" onSubmit={save}>
      <div className="form-grid">
        <label>الفندق<select required value={form.hotel_id} onChange={e => setForm({ ...form, hotel_id: e.target.value })}><option value="">اختر الفندق</option>{hotels.filter(h => h.active).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
        <label>المنصة<select required value={form.platform_id} onChange={e => setForm({ ...form, platform_id: e.target.value })}><option value="">اختر المنصة</option>{platforms.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>تاريخ الحجز<input type="date" value={form.booking_date} onChange={e => setForm({ ...form, booking_date: e.target.value })} /></label>
        <label>إجمالي الحجوزات<input required type="number" min="0" value={form.total_bookings} onChange={e => setForm({ ...form, total_bookings: e.target.value })} /></label>
        <label>الحجوزات المدفوعة<input required type="number" min="0" value={form.paid_bookings} onChange={e => setForm({ ...form, paid_bookings: e.target.value })} /></label>
        <label>الحجوزات الكاش<input disabled value={cash} /></label>
        <label>الموظف<select value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}><option value="">أنا</option>{emps.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.display_name}</option>)}</select></label>
      </div>
      <button className="btn primary">حفظ الحجز</button>{msg && <span className="inline-msg">{msg}</span>}
    </form>
    <div className="filters no-print">
      <label>من<input type="date" value={start} onChange={e => setStart(e.target.value)} /></label><label>إلى<input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>
      <label>الفندق<select value={hotelFilter} onChange={e => setHotelFilter(e.target.value)}><option value="">كل الفنادق</option>{hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
      <label>المنصة<select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}><option value="">كل المنصات</option>{platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <button className="btn secondary" onClick={load}>عرض</button>
    </div>
    <div className="panel"><div className="table-wrap"><table><thead><tr><th>التاريخ</th><th>الفندق</th><th>المنصة</th><th>الإجمالي</th><th>مدفوع</th><th>كاش</th><th>الموظف</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.booking_date}</td><td>{r.hotel_name}</td><td>{r.platform_name}</td><td>{r.total_bookings}</td><td>{r.paid_bookings}</td><td>{r.cash_bookings}</td><td>{r.employee_name}</td></tr>)}</tbody></table></div></div>
  </section>
}
