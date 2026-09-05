import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getDashboard, getHotels, Hotel } from '../api'
import StatCard from '../components/StatCard'
import PrintButton from '../components/PrintButton'
import { useRealtime } from '../useRealtime'
import { Link } from 'react-router-dom'

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

      <div className="dashboard-chart-grid print-friendly">
        {(showRevenue || showBookings) && (
          <div className="panel chart-panel chart-panel-narrow">
            <h3>{showRevenue && !showBookings ? 'صافي الإيراد حسب الفندق' : 'أداء الفندق — الحجوزات وصافي الإيراد'}</h3>
            <ResponsiveContainer width="100%" height={225}>
              <BarChart data={(d.revenue_by_hotel.length ? d.revenue_by_hotel : DEFAULTS.revenue_by_hotel).slice(0, 8)} margin={{ top: 8, right: 10, left: 2, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-16} textAnchor="end" height={45} tickFormatter={(value: string) => value.length > 14 ? `${value.slice(0,14)}…` : value} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" name="صافي الإيراد" fill="#23698e" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {(showBookings || section === 'all') && (
          <div className="panel chart-panel chart-panel-narrow">
            <h3>مزيج المدفوع والكاش</h3>
            <ResponsiveContainer width="100%" height={225}>
              <PieChart>
                <Pie data={d.paid_cash} dataKey="value" nameKey="name" cx="50%" cy="48%" outerRadius={68} innerRadius={34} label>
                  {d.paid_cash.map((_: any, i: number) => <Cell key={i} fill={['#23698e', '#78a9c7'][i % 2]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {(showReviews || showRatings || section === 'all') && (
          <div className="panel chart-panel chart-panel-narrow">
            <h3>اتجاه التقييمات</h3>
            <ResponsiveContainer width="100%" height={225}>
              <BarChart data={sentimentData} margin={{ top: 8, right: 10, left: 2, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="عدد التقييمات" fill="#3f7ea3" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
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
