import { useEffect, useMemo, useState } from 'react'
import { getDashboard, getHotels, Hotel } from '../api'
import StatCard from '../components/StatCard'
import PrintButton from '../components/PrintButton'
import { useRealtime } from '../useRealtime'
import { Link } from 'react-router-dom'
import { DonutChart, HorizontalBars, ProgressList } from '../components/ReportCharts'

const DEFAULTS = {
  kpis: {
    reviews: 0,
    bookings: 0,
    paid_bookings: 0,
    cash_bookings: 0,
    actual_revenue: 0,
    commission: 0,
    net_revenue: 0,
    average_rating: 0,
  },
  revenue_by_hotel: [{ name: 'لا توجد بيانات', value: 0 }],
  paid_cash: [{ name: 'مدفوع', value: 0 }, { name: 'كاش', value: 0 }],
  sentiment: [
    { name: 'إيجابي', value: 0 },
    { name: 'سلبي', value: 0 },
    { name: 'محايد', value: 0 },
  ],
  hotel_performance: [],
}

const sectionOptions = [
  { value: 'all', label: 'الكل' },
  { value: 'bookings', label: 'الحجوزات اليومية' },
  { value: 'revenue', label: 'الإيرادات اليومية' },
  { value: 'reviews', label: 'التقييمات' },
  { value: 'ratings', label: 'تقييمات الفنادق' },
]

const safe = (value: any) => Number.isFinite(Number(value)) ? Number(value) : 0

export default function Home() {
  const tick = useRealtime()
  const today = new Date().toISOString().slice(0, 10)
  const [start, setStart] = useState(`${today.slice(0, 8)}01`)
  const [end, setEnd] = useState(today)
  const [hotelId, setHotelId] = useState('')
  const [section, setSection] = useState('all')
  const [data, setData] = useState<any>(null)
  const [hotels, setHotels] = useState<Hotel[]>([])

  const load = () => getDashboard(new URLSearchParams({ start, end, ...(hotelId ? { hotel_id: hotelId } : {}) }).toString()).then(setData)

  useEffect(() => { getHotels().then(setHotels) }, [])
  useEffect(() => { load() }, [tick])

  const d = useMemo(() => ({ ...DEFAULTS, ...(data || {}), kpis: { ...DEFAULTS.kpis, ...(data?.kpis || {}) } }), [data])

  const showBookings = section === 'all' || section === 'bookings'
  const showRevenue = section === 'all' || section === 'revenue'
  const showReviews = section === 'all' || section === 'reviews'
  const showRatings = section === 'all' || section === 'ratings'

  const actions = [
    ['التقييمات', '/reviews', '📝', 'reviews'],
    ['الحجوزات اليومية', '/bookings', '📅', 'bookings'],
    ['الإيرادات اليومية', '/revenue', '💵', 'revenue'],
    ['التقرير الشهري', '/monthly', '📊', 'all'],
  ] as const

  const visibleActions = section === 'all' ? actions : actions.filter(a => a[3] === section || a[3] === 'all')

  const sentimentData = [
    { name: 'إيجابي', value: safe(d.sentiment.find((x: any) => String(x.name).toLowerCase().includes('إيج') || String(x.name).toLowerCase() === 'positive')?.value) },
    { name: 'سلبي', value: safe(d.sentiment.find((x: any) => String(x.name).toLowerCase().includes('سلب') || String(x.name).toLowerCase() === 'negative')?.value) },
    { name: 'محايد', value: safe(d.sentiment.find((x: any) => String(x.name).toLowerCase().includes('محا') || String(x.name).toLowerCase() === 'neutral')?.value) },
  ]

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>لوحة أداء الفنادق</h2>
          <p>مركز التحكم التنفيذي والتقارير السريعة</p>
        </div>
        <div className="actions no-print">
          <button className="btn primary" onClick={load}>عرض التقرير</button>
          <button className="btn secondary" onClick={load}>تحديث البيانات</button>
          <PrintButton label="طباعة لوحة التقرير" />
        </div>
      </div>

      <div className="filters no-print dashboard-filters">
        <label>من تاريخ<input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
        <label>إلى تاريخ<input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>
        <label>الفندق<select value={hotelId} onChange={e => setHotelId(e.target.value)}><option value="">كل الفنادق</option>{hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
        <label>القسم<select value={section} onChange={e => setSection(e.target.value)}>{sectionOptions.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
      </div>

      <div className="stats">
        {(showReviews || section === 'all') && <StatCard title="إجمالي التقييمات" value={d.kpis.reviews} />}
        {(showBookings || section === 'all') && <StatCard title="إجمالي الحجوزات" value={d.kpis.bookings} />}
        {(showBookings || section === 'all') && <StatCard title="الحجوزات المدفوعة" value={d.kpis.paid_bookings} />}
        {(showBookings || section === 'all') && <StatCard title="الحجوزات الكاش" value={d.kpis.cash_bookings} />}
        {(showRevenue || section === 'all') && <StatCard title="الإيراد الفعلي" value={d.kpis.actual_revenue} />}
        {(showRevenue || section === 'all') && <StatCard title="العمولة" value={d.kpis.commission} />}
        {(showRevenue || section === 'all') && <StatCard title="صافي الإيراد" value={d.kpis.net_revenue} />}
        {(showRatings || section === 'all') && <StatCard title="متوسط التقييم" value={d.kpis.average_rating} unit="/10" />}
      </div>

      <div className="quick-grid no-print">
        {visibleActions.map(([label, to, icon]) => <Link className="quick-card" to={to} key={to}><span>{icon}</span><b>فتح {label}</b></Link>)}
      </div>

      <div className="dashboard-chart-grid print-friendly visual-chart-grid">
        {(showBookings || showRevenue) && (
          <>
            {showBookings && <HorizontalBars title="الحجوزات حسب الفندق" data={(d.hotel_performance || []).map((r: any) => ({ name: r.hotel || '', value: safe(r.bookings) }))} maxItems={7} />}
            {showRevenue && <HorizontalBars title="صافي الإيراد حسب الفندق" data={(d.revenue_by_hotel || []).map((r: any) => ({ name: r.name || '', value: safe(r.value) }))} maxItems={7} valueSuffix="" />}
          </>
        )}
        {(showBookings || section === 'all') && <DonutChart title="مزيج المدفوع والكاش" paid={safe(d.kpis.paid_bookings)} cash={safe(d.kpis.cash_bookings)} />}
        {(showReviews || showRatings || section === 'all') && <ProgressList title="اتجاه التقييمات" max={Math.max(1, ...sentimentData.map(x => safe(x.value)))} items={sentimentData.map(x => ({ name: x.name, value: safe(x.value) }))} />}
      </div>

      {showBookings && (
        <div className="panel print-friendly">
          <h3>أداء الفنادق</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>الفندق</th><th>الحجوزات</th><th>مدفوع</th><th>كاش</th></tr></thead>
              <tbody>
                {(d.hotel_performance || []).length ? d.hotel_performance.map((r: any) => (
                  <tr key={r.hotel}><td>{r.hotel}</td><td>{r.bookings}</td><td>{r.paid}</td><td>{r.cash}</td></tr>
                )) : <tr><td colSpan={4} className="empty-cell">لا توجد بيانات للحجوزات في الفترة المحددة.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
