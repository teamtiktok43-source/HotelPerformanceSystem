import { useEffect, useMemo, useState } from 'react'
import { getDashboard, getHotels, Hotel } from '../api'
import StatCard from '../components/StatCard'
import PrintButton from '../components/PrintButton'
import { useRealtime } from '../useRealtime'
import { Link } from 'react-router-dom'
import { DonutChart, HorizontalBars, PlatformShareChart, ProgressList } from '../components/ReportCharts'
import { Star, CalendarDays, CreditCard, Users, BarChart3, Coins, Receipt, Hotel as HotelIcon, ClipboardList, DollarSign } from 'lucide-react'

const DEFAULTS = {
  kpis: {
    reviews: 0,
    bookings: 0,
    paid_bookings: 0,
    cash_bookings: 0,
    actual_revenue: 0,
    commission: 0,
    net_revenue: 0,
    tax: 0,
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
  platform_breakdown: { bookings: [], reviews: [], revenue: [] },
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
  const [loadError, setLoadError] = useState('')

  const load = async () => {
    try {
      const result = await getDashboard(
        new URLSearchParams({
          start,
          end,
          ...(hotelId ? { hotel_id: hotelId } : {}),
        }).toString()
      )
      setData(result)
      setLoadError('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'حدث خطأ في تحميل لوحة الأداء'
      setLoadError(message)
    }
  }

  useEffect(() => {
    getHotels().then(setHotels).catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [tick])

  const d = useMemo(
    () => ({
      ...DEFAULTS,
      ...(data || {}),
      kpis: { ...DEFAULTS.kpis, ...(data?.kpis || {}) },
    }),
    [data]
  )

  const showBookings = section === 'all' || section === 'bookings'
  const showRevenue = section === 'all' || section === 'revenue'
  const showReviews = section === 'all' || section === 'reviews'
  const showRatings = section === 'all' || section === 'ratings'

  const actions = [
    ['التقييمات', '/reviews', <ClipboardList size={21} strokeWidth={2.1} />, 'reviews'],
    ['الحجوزات اليومية', '/bookings', <CalendarDays size={21} strokeWidth={2.1} />, 'bookings'],
    ['الإيرادات اليومية', '/revenue', <DollarSign size={21} strokeWidth={2.1} />, 'revenue'],
    ['التقرير الشهري', '/monthly', <BarChart3 size={21} strokeWidth={2.1} />, 'all'],
  ] as const

  const visibleActions = section === 'all' ? actions : actions.filter(a => a[3] === section || a[3] === 'all')

  const sentimentData = [
    {
      name: 'إيجابي',
      value: safe(
        d.sentiment.find(
          (x: any) => String(x.name).toLowerCase().includes('إيج') || String(x.name).toLowerCase() === 'positive'
        )?.value
      ),
    },
    {
      name: 'سلبي',
      value: safe(
        d.sentiment.find(
          (x: any) => String(x.name).toLowerCase().includes('سلب') || String(x.name).toLowerCase() === 'negative'
        )?.value
      ),
    },
    {
      name: 'محايد',
      value: safe(
        d.sentiment.find(
          (x: any) => String(x.name).toLowerCase().includes('محا') || String(x.name).toLowerCase() === 'neutral'
        )?.value
      ),
    },
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

      {loadError && (
        <div className="toast error no-print" role="alert">
          تعذر تحميل لوحة الأداء: {loadError}
        </div>
      )}

      <div className="home-hero print-friendly">
        <div className="home-hero-overlay" />
        <div className="home-hero-content">
          <div className="home-hero-eyebrow">HOTEL PERFORMANCE SYSTEM</div>
          <h2>لوحة أداء الفنادق</h2>
          <p>رؤية أوضح .. قرارات أسرع .. أداء أفضل</p>
        </div>
        <div className="home-hero-date">
          <span>التاريخ</span>
          <strong>{new Intl.DateTimeFormat('ar-EG', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())}</strong>
          <CalendarDays size={24} strokeWidth={1.8} />
        </div>
      </div>

      <div className="filters no-print dashboard-filters">
        <label>
          من تاريخ
          <input type="date" value={start} onChange={e => setStart(e.target.value)} />
        </label>
        <label>
          إلى تاريخ
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} />
        </label>
        <label>
          الفندق
          <select value={hotelId} onChange={e => setHotelId(e.target.value)}>
            <option value="">كل الفنادق</option>
            {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </label>
        <label>
          القسم
          <select value={section} onChange={e => setSection(e.target.value)}>
            {sectionOptions.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        </label>
      </div>

      <div className="stats">
        {(showReviews || section === 'all') && <StatCard title="إجمالي التقييمات" value={d.kpis.reviews} icon={<Star size={23} strokeWidth={2.2} />} accentColor="pink" sparklineData={[2, 2, 3, 2, 4, 3, 4, 5]} />}
        {(showBookings || section === 'all') && <StatCard title="إجمالي الحجوزات" value={d.kpis.bookings} icon={<CalendarDays size={23} strokeWidth={2.2} />} accentColor="cyan" sparklineData={[2, 3, 2, 4, 4, 3, 5, 5]} />}
        {(showBookings || section === 'all') && <StatCard title="الحجوزات المدفوعة" value={d.kpis.paid_bookings} icon={<CreditCard size={23} strokeWidth={2.2} />} accentColor="violet" sparklineData={[1, 2, 2, 3, 2, 4, 4, 5]} />}
        {(showBookings || section === 'all') && <StatCard title="الحجوزات الكاش" value={d.kpis.cash_bookings} icon={<Users size={23} strokeWidth={2.2} />} accentColor="orange" sparklineData={[1, 1, 2, 2, 3, 2, 4, 3]} />}
        {(showRevenue || section === 'all') && <StatCard title="السعر الإجمالي" value={d.kpis.actual_revenue} icon={<BarChart3 size={23} strokeWidth={2.2} />} accentColor="blue" sparklineData={[1, 2, 2, 3, 3, 4, 5, 5]} />}
        {(showRevenue || section === 'all') && <StatCard title="العمولة" value={d.kpis.commission} icon={<Coins size={23} strokeWidth={2.2} />} accentColor="green" sparklineData={[1, 1, 2, 2, 2, 3, 3, 4]} />}
        {(showRevenue || section === 'all') && <StatCard title="الضرائب" value={d.kpis.tax} icon={<Receipt size={23} strokeWidth={2.2} />} accentColor="red" sparklineData={[1, 2, 1, 2, 1, 3, 2, 2]} />}
        {(showRevenue || section === 'all') && <StatCard title="صافي الإيراد" value={d.kpis.net_revenue} icon={<HotelIcon size={23} strokeWidth={2.2} />} accentColor="purple" sparklineData={[2, 2, 3, 3, 4, 4, 5, 5]} />}
        {(showRatings || section === 'all') && <StatCard title="متوسط التقييم" value={d.kpis.average_rating} unit="/10" icon={<Star size={23} strokeWidth={2.2} />} accentColor="pink" sparklineData={[3, 4, 4, 5, 4, 5, 5, 6]} />}
      </div>

      <div className="quick-grid no-print">
        {visibleActions.map((action) => <Link className="quick-card" to={action[1]} key={action[1]}><span>{action[2]}</span><b>فتح {action[0]}</b></Link>)}
      </div>

      <div className="platform-section print-friendly">
        <div className="platform-section-head">
          <div>
            <h3>توزيع الأداء حسب المنصة</h3>
            <p>نسبة الحجوزات والتقييمات والقيمة المالية حسب مصدر الحجز.</p>
          </div>
          <Link className="platform-manage-link no-print" to="/platforms">إدارة المنصات</Link>
        </div>
        <div className="platform-chart-grid">
          <PlatformShareChart title="نسبة الحجوزات حسب المنصة" items={d.platform_breakdown?.bookings || []} />
          <PlatformShareChart title="نسبة التقييمات حسب المنصة" items={d.platform_breakdown?.reviews || []} />
          <PlatformShareChart title="نسبة السعر الإجمالي حسب المنصة" items={d.platform_breakdown?.revenue || []} />
        </div>
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
              <thead>
                <tr><th>الفندق</th><th>الحجوزات</th><th>مدفوع</th><th>كاش</th></tr>
              </thead>
              <tbody>
                {(d.hotel_performance || []).length ? d.hotel_performance.map((r: any) => (
                  <tr key={r.hotel}><td>{r.hotel}</td><td>{r.bookings}</td><td>{r.paid}</td><td>{r.cash}</td></tr>
                )) : (
                  <tr><td colSpan={4} className="empty-cell">لا توجد بيانات للحجوزات في الفترة المحددة.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
