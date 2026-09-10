import { FormEvent, useEffect, useState } from 'react'
import { createRevenue, getEmployees, getHotels, getPlatforms, getLocalDateString, Hotel, User, Platform, getRevenue } from '../api'
import PrintButton from '../components/PrintButton'
import { useRealtime } from '../useRealtime'
import { HorizontalBars } from '../components/ReportCharts'

const safeNumber = (value: any) => Number.isFinite(Number(value)) ? Number(value) : 0

export default function DailyRevenue() {
  const tick = useRealtime()
  const today = getLocalDateString()
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [emps, setEmps] = useState<User[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [hotelFilter, setHotelFilter] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [form, setForm] = useState({ booking_number: '', hotel_id: '', platform: 'Booking.com', platform_id: '', revenue_date: today, actual_price: '', commissionable_amount: '', employee_id: '' })
  const [msg, setMsg] = useState('')

  const load = () => {
    const params = new URLSearchParams()
    if (start) params.set('start', start)
    if (end) params.set('end', end)
    if (hotelFilter) params.set('hotel_id', hotelFilter)
    if (platformFilter) params.set('platform_id', platformFilter)
    return getRevenue(params.toString()).then(setRows)
  }
  useEffect(() => { getHotels().then(setHotels); getEmployees().then(setEmps); getPlatforms().then(setPlatforms) }, [])
  useEffect(() => { load() }, [tick, start, end, hotelFilter, platformFilter])

  const hotel = hotels.find(h => String(h.id) === form.hotel_id)
  const rate = safeNumber(hotel?.commission_rate)
  const taxRate = safeNumber(hotel?.tax_rate)
  const commission = safeNumber(form.commissionable_amount) * rate
  const tax = safeNumber(form.actual_price) * taxRate
  const net = safeNumber(form.actual_price) - commission - tax

  async function save(e: FormEvent) {
    e.preventDefault()
    try {
      await createRevenue({ ...form, hotel_id: Number(form.hotel_id), platform_id: form.platform_id ? Number(form.platform_id) : undefined, actual_price: Number(form.actual_price), commissionable_amount: Number(form.commissionable_amount), employee_id: form.employee_id ? Number(form.employee_id) : undefined })
      setMsg('تم حفظ الإيراد')
      setForm({ ...form, booking_number: '', actual_price: '', commissionable_amount: '' })
      load()
    } catch (ex: any) { setMsg(ex.message) }
  }

  const chart = rows.slice(0, 12).map(r => ({ name: r.hotel_name, value: r.net_revenue }))
  return <section className="page">
    <div className="page-head"><div><h2>الإيرادات اليومية</h2><p>العمولة والضريبة تُحتسبان تلقائيًا حسب الفندق.</p></div><div className="actions no-print"><PrintButton /></div></div>
    <form className="form-card no-print" onSubmit={save}><div className="form-grid">
      <label>رقم الحجز<input required value={form.booking_number} onChange={e => setForm({ ...form, booking_number: e.target.value })} /></label>
      <label>الفندق<select required value={form.hotel_id} onChange={e => setForm({ ...form, hotel_id: e.target.value })}><option value="">اختر الفندق</option>{hotels.filter(h => h.active).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
      <label>المنصة<select required value={form.platform_id} onChange={e => { const id = e.target.value; const p = platforms.find(x => String(x.id) === id); setForm({ ...form, platform_id: id, platform: p?.name || 'Booking.com' }) }}><option value="">اختر المنصة</option>{platforms.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>تاريخ الإيراد<input type="date" value={form.revenue_date} onChange={e => setForm({ ...form, revenue_date: e.target.value })} /></label>
      <label>السعر الإجمالي<input type="number" min="0" step="0.01" value={form.actual_price} onChange={e => setForm({ ...form, actual_price: e.target.value })} /></label>
      <label>المبلغ الخاضع للعمولة<input type="number" min="0" step="0.01" value={form.commissionable_amount} onChange={e => setForm({ ...form, commissionable_amount: e.target.value })} /></label>
      <label>نسبة العمولة<input disabled value={`${(rate * 100).toFixed(2)}%`} /></label>
      <label>نسبة الضريبة<input disabled value={`${(taxRate * 100).toFixed(2)}%`} /></label>
      <label>العمولة<input disabled value={commission.toFixed(2)} /></label>
      <label>الضريبة<input disabled value={tax.toFixed(2)} /></label>
      <label>صافي الإيراد<input disabled value={net.toFixed(2)} /></label>
      <label>الموظف<select value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}><option value="">أنا</option>{emps.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.display_name}</option>)}</select></label>
    </div><button className="btn primary">حفظ الإيراد</button>{msg && <span className="inline-msg">{msg}</span>}</form>
    <div className="filters no-print">
      <label>من<input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
      <label>إلى<input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>
      <label>الفندق<select value={hotelFilter} onChange={e => setHotelFilter(e.target.value)}><option value="">كل الفنادق</option>{hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
      <label>المنصة<select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}><option value="">كل المنصات</option>{platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <button className="btn secondary" onClick={load}>عرض</button>
    </div>
    <div className="report-layout print-friendly"><div className="panel"><h3>سجل الإيرادات</h3><div className="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحجز</th><th>الفندق</th><th>المنصة</th><th>الإجمالي</th><th>العمولة</th><th>الضريبة</th><th>الصافي</th><th>الموظف</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.revenue_date}</td><td>{r.booking_number}</td><td>{r.hotel_name}</td><td>{r.platform_name || r.platform}</td><td>{safeNumber(r.actual_price).toFixed(2)}</td><td>{safeNumber(r.commission).toFixed(2)}</td><td>{safeNumber(r.tax).toFixed(2)}</td><td>{safeNumber(r.net_revenue).toFixed(2)}</td><td>{r.employee_name}</td></tr>)}</tbody></table></div></div><HorizontalBars title="صافي الإيراد حسب الفندق" data={chart} maxItems={7} /></div>
  </section>
}
