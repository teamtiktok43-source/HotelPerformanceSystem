import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  Hotel as HotelIcon,
  Star,
  Users,
} from 'lucide-react'
import { getHotels, getMonthly, Hotel } from '../api'
import StatCard from '../components/StatCard'
import PrintButton from '../components/PrintButton'
import { ComparisonDonut, HorizontalBars, PlatformShareChart } from '../components/ReportCharts'

function monthName(m: number) {
  return new Intl.DateTimeFormat('ar-EG', { month: 'long' }).format(new Date(2024, m - 1, 1))
}

function monthLabel(y: number, m: number) {
  return `${monthName(m)} ${y}`
}

const num = (value: any) =>
  Number.isFinite(Number(value)) ? Number(value) : 0

function previousMonth(y: number, m: number) {
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 }
}


function platformKey(name: string) {
  const value = String(name || '').toLowerCase()
  if (value.includes('booking')) return 'booking'
  if (value.includes('expedia')) return 'expedia'
  if (value.includes('trip')) return 'trip'
  if (value.includes('agoda')) return 'agoda'
  return 'other'
}

function PlatformPrintIcon({ name }: { name: string }) {
  const key = platformKey(name)
  return (
    <span className={`monthly-platform-print-icon ${key}`} aria-hidden="true">
      {key === 'booking' ? 'B' : key === 'expedia' ? '↗' : key === 'trip' ? 'T' : key === 'agoda' ? 'A' : '•'}
    </span>
  )
}

function formatNumber(value: number, fractionDigits = 0) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

function PrintMetricCard({
  label,
  value,
  icon,
  accent = 'blue',
  suffix,
}: {
  label: string
  value: string | number
  icon: ReactNode
  accent?: string
  suffix?: string
}) {
  return (
    <div className={`monthly-print-metric ${accent}`}>
      <div className="monthly-print-metric-icon">{icon}</div>
      <div className="monthly-print-metric-copy">
        <span>{label}</span>
        <strong>{value}{suffix ? <small>{suffix}</small> : null}</strong>
      </div>
    </div>
  )
}

function PrintPlatformPanel({
  title,
  items,
  emptyLabel = 'لا توجد بيانات',
  formatValue = (v: number) => formatNumber(v),
}: {
  title: string
  items: { platform: string; value: number; percentage: number }[]
  emptyLabel?: string
  formatValue?: (v: number) => string
}) {
  const rows = Array.isArray(items) ? items.filter((item) => num(item.value) > 0) : []
  return (
    <div className="monthly-print-platform-panel">
      <div className="monthly-print-block-title">{title}</div>
      {rows.length ? (
        <div className="monthly-print-platform-list">
          {rows.map((item) => (
            <div className="monthly-print-platform-row" key={`${title}-${item.platform}`}>
              <div className="monthly-print-platform-name">
                <PlatformPrintIcon name={item.platform} />
                <span>{item.platform}</span>
              </div>
              <strong>{formatValue(num(item.value))}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="monthly-print-empty">{emptyLabel}</div>
      )}
    </div>
  )
}

function PrintRankingPanel({
  title,
  data,
  valueLabel,
  valueKey,
  direction,
  valueFormatter = (value: number) => formatNumber(value),
}: {
  title: string
  data: any[]
  valueLabel: string
  valueKey: 'bookings' | 'actual_revenue' | 'average_rating'
  direction: 'up' | 'down'
  valueFormatter?: (value: number) => string
}) {
  const items = [...data].slice(0, 10)
  while (items.length < 10) items.push(null)
  return (
    <div className="monthly-print-ranking-panel">
      <div className="monthly-print-ranking-head">
        <strong>{title}</strong>
        <span>{valueLabel}</span>
      </div>
      <div className="monthly-print-ranking-list">
        {items.map((item, index) => (
          <div className="monthly-print-ranking-row" key={`${title}-${index}`}>
            <span className="monthly-print-ranking-number">{index + 1}</span>
            <span className="monthly-print-ranking-name">{item?.hotel_name || '—'}</span>
            <span
              className={`monthly-print-ranking-trend ${direction}`}
              aria-label={direction === 'up' ? 'اتجاه صاعد' : 'اتجاه هابط'}
              title={direction === 'up' ? 'أعلى أداء' : 'أقل أداء'}
            >
              {direction === 'up' ? <ArrowUp size={10} strokeWidth={2.8} /> : <ArrowDown size={10} strokeWidth={2.8} />}
            </span>
            <strong>{item ? valueFormatter(num(item[valueKey])) : '—'}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function PrintComparisonTable({
  currentLabel,
  previousLabel,
  current,
  previous,
}: {
  currentLabel: string
  previousLabel: string
  current: { bookings: number; actual_revenue: number; reviews: number }
  previous: { bookings: number; actual_revenue: number; reviews: number }
}) {
  const rows = [
    ['إجمالي الحجوزات', current.bookings, previous.bookings, (v: number) => formatNumber(v)],
    ['إجمالي الإيرادات', current.actual_revenue, previous.actual_revenue, (v: number) => formatNumber(v, 2)],
    ['إجمالي التقييمات', current.reviews, previous.reviews, (v: number) => formatNumber(v)],
  ] as const
  return (
    <div className="monthly-print-comparison-table">
      <div className="monthly-print-comparison-head">
        <div>المؤشر</div>
        <div>{currentLabel}</div>
        <div>{previousLabel}</div>
      </div>
      {rows.map(([label, currentValue, previousValue, formatter]) => (
        <div className="monthly-print-comparison-row" key={label}>
          <strong>{label}</strong>
          <span>{formatter(num(currentValue))}</span>
          <span>{formatter(num(previousValue))}</span>
        </div>
      ))}
    </div>
  )
}

function MonthlyPrintReport({
  heroDate,
  previousPeriod,
  selectedHotelName,
  totals,
  prevTotals,
  d,
  top10,
  bottom10,
  currentRevenue,
  bottomRevenue,
  previousRevenue,
  currentRatings,
  bottomRatings,
  previousRatings,
  rows,
  bookingTop,
  bookingBottom,
}: {
  heroDate: string
  previousPeriod: { year: number; month: number }
  selectedHotelName: string
  totals: any
  prevTotals: any
  d: any
  top10: any[]
  bottom10: any[]
  currentRevenue: any[]
  bottomRevenue: any[]
  previousRevenue: any[]
  currentRatings: any[]
  bottomRatings: any[]
  previousRatings: any[]
  rows: any[]
  bookingTop: number
  bookingBottom: number
}) {
  const currentPeriodLabel = monthLabel(totals.__year, totals.__month)
  const previousPeriodLabel = monthLabel(previousPeriod.year, previousPeriod.month)
  const currentPlatformBookings = d.platform_breakdown?.bookings || []
  const currentPlatformReviews = d.platform_breakdown?.reviews || []
  const currentPlatformRevenue = d.platform_breakdown?.revenue || []

  return (
    <div className="monthly-print-report" aria-hidden="true">
      <section className="monthly-print-page monthly-print-page-one">
        <div className="monthly-print-header">
          <div className="monthly-print-brand">
            <div className="monthly-print-brand-mark">H</div>
            <div>
              <strong>HOTEL</strong>
              <span>PERFORMANCE SYSTEM</span>
            </div>
          </div>
          <div className="monthly-print-title">
            <span>التقرير الشهري</span>
            <strong>{heroDate}</strong>
            <small>التقرير التفصيلي</small>
          </div>
          <div className="monthly-print-period-badge">
            <span>الفترة الحالية</span>
            <strong>{heroDate}</strong>
          </div>
        </div>

        <div className="monthly-print-overview-grid">
          <PrintMetricCard label="إجمالي الحجوزات" value={formatNumber(totals.bookings)} icon={<CalendarDays size={19} />} accent="cyan" />
          <PrintMetricCard label="إجمالي الإيراد" value={formatNumber(totals.actual_revenue, 2)} suffix=" EGP" icon={<CircleDollarSign size={19} />} accent="gold" />
          <PrintMetricCard label="إجمالي التقييمات" value={formatNumber(totals.reviews)} icon={<Star size={19} />} accent="pink" />
          <PrintMetricCard label="متوسط التقييم" value={totals.average_rating.toFixed(2)} suffix=" /10" icon={<Star size={19} />} accent="violet" />
          <PrintMetricCard label="النطاق" value={selectedHotelName} icon={<HotelIcon size={19} />} accent="blue" />
        </div>

        <div className="monthly-print-three-col">
          <div className="monthly-print-card">
            <div className="monthly-print-card-title"><span>الحجوزات</span><CalendarDays size={18} /></div>
            <div className="monthly-print-big-number">{formatNumber(totals.bookings)}</div>
            <PrintPlatformPanel title="الحجوزات حسب المنصة" items={currentPlatformBookings} />
          </div>

          <div className="monthly-print-card">
            <div className="monthly-print-card-title"><span>الإيرادات</span><CircleDollarSign size={18} /></div>
            <div className="monthly-print-big-number">{formatNumber(totals.actual_revenue, 2)} <small>EGP</small></div>
            <div className="monthly-print-mini-grid">
              <div><span>مدفوع</span><strong>{formatNumber(totals.paid)}</strong><small>حجز</small></div>
              <div><span>كاش</span><strong>{formatNumber(totals.cash)}</strong><small>حجز</small></div>
            </div>
          </div>

          <div className="monthly-print-card">
            <div className="monthly-print-card-title"><span>التقييمات</span><Star size={18} /></div>
            <div className="monthly-print-big-number">{formatNumber(totals.reviews)}</div>
            <PrintPlatformPanel title="التقييمات حسب المنصة" items={currentPlatformReviews} />
          </div>
        </div>

        <div className="monthly-print-summary-strip">
          <div><span>الفترة الحالية</span><strong>{currentPeriodLabel}</strong></div>
          <div><span>الفترة السابقة</span><strong>{previousPeriodLabel}</strong></div>
          <div><span>الفندق</span><strong>{selectedHotelName}</strong></div>
          <div><span>إجمالي الحجوزات</span><strong>{formatNumber(totals.bookings)}</strong></div>
          <div><span>متوسط التقييم</span><strong>{totals.average_rating.toFixed(2)} /10</strong></div>
          <div><span>إجمالي الإيراد</span><strong>{formatNumber(totals.actual_revenue, 2)}</strong></div>
        </div>

        <PrintPlatformPanel
          title="السعر الإجمالي حسب المنصة"
          items={currentPlatformRevenue}
          formatValue={(v) => `${formatNumber(v, 2)} EGP`}
        />

        <div className="monthly-print-footer">
          <span>رؤية أوضح .. قرارات أسرع .. أداء أفضل</span>
          <strong>1 / 4</strong>
          <small>HOTEL PERFORMANCE SYSTEM — Confidential Report</small>
        </div>
      </section>

      <section className="monthly-print-page monthly-print-page-two">
        <div className="monthly-print-section-heading">
          <div>
            <span>MONTHLY HOTEL PERFORMANCE</span>
            <h2>أداء الفنادق</h2>
          </div>
          <small>مقارنة أعلى 10 وأقل 10 فنادق</small>
        </div>

        <div className="monthly-print-section-block">
          <div className="monthly-print-section-line"><h3>أداء الفنادق — الحجوزات</h3><span>الحجوزات الحالية</span></div>
          <div className="monthly-print-ranking-grid">
            <PrintRankingPanel title="أعلى 10 فنادق (حجوزات)" valueLabel="عدد الحجوزات" valueKey="bookings" direction="up" data={top10} />
            <PrintRankingPanel title="أقل 10 فنادق (حجوزات)" valueLabel="عدد الحجوزات" valueKey="bookings" direction="down" data={bottom10} />
          </div>
        </div>

        <div className="monthly-print-section-block">
          <div className="monthly-print-section-line"><h3>أداء الفنادق — إجمالي الإيرادات</h3><span>{currentPeriodLabel}</span></div>
          <div className="monthly-print-ranking-grid">
            <PrintRankingPanel title="أعلى 10 فنادق (إيرادات)" valueLabel="إجمالي الإيرادات" valueKey="actual_revenue" direction="up" data={currentRevenue} valueFormatter={(v) => formatNumber(v, 2)} />
            <PrintRankingPanel title="أقل 10 فنادق (إيرادات)" valueLabel="إجمالي الإيرادات" valueKey="actual_revenue" direction="down" data={bottomRevenue} valueFormatter={(v) => formatNumber(v, 2)} />
          </div>
        </div>

        <div className="monthly-print-section-block">
          <div className="monthly-print-section-line"><h3>أداء الفنادق — التقييمات</h3><span>متوسط التقييم</span></div>
          <div className="monthly-print-ranking-grid">
            <PrintRankingPanel title="أعلى 10 فنادق (التقييمات)" valueLabel="متوسط التقييم" valueKey="average_rating" direction="up" data={currentRatings} valueFormatter={(v) => `${formatNumber(v, 2)} /10`} />
            <PrintRankingPanel title="أقل 10 فنادق (التقييمات)" valueLabel="متوسط التقييم" valueKey="average_rating" direction="down" data={bottomRatings} valueFormatter={(v) => `${formatNumber(v, 2)} /10`} />
          </div>
        </div>

        <div className="monthly-print-footer">
          <span>Monthly Performance Analysis</span>
          <strong>2 / 4</strong>
          <small>{heroDate}</small>
        </div>
      </section>

      <section className="monthly-print-page monthly-print-page-three">
        <div className="monthly-print-section-heading">
          <div>
            <span>CURRENT VS PREVIOUS</span>
            <h2>المقارنة الشهرية</h2>
          </div>
          <small>{currentPeriodLabel} مقابل {previousPeriodLabel}</small>
        </div>

        <PrintComparisonTable
          currentLabel={currentPeriodLabel}
          previousLabel={previousPeriodLabel}
          current={totals}
          previous={prevTotals}
        />

        <div className="monthly-print-comparison-kpis">
          <div><span>الحجوزات</span><strong>{formatNumber(totals.bookings)}</strong><small>السابق {formatNumber(prevTotals.bookings)}</small></div>
          <div><span>الإيرادات</span><strong>{formatNumber(totals.actual_revenue, 2)}</strong><small>السابق {formatNumber(prevTotals.actual_revenue, 2)}</small></div>
          <div><span>التقييمات</span><strong>{formatNumber(totals.reviews)}</strong><small>السابق {formatNumber(prevTotals.reviews)}</small></div>
        </div>

        <div className="monthly-print-donut-grid">
          <ComparisonDonut title="الحجوزات — الحالي مقابل السابق" current={totals.bookings} previous={prevTotals.bookings} />
          <ComparisonDonut title="الإيرادات — الحالي مقابل السابق" current={totals.actual_revenue} previous={prevTotals.actual_revenue} formatValue={(v) => formatNumber(v, 2)} />
          <ComparisonDonut title="التقييمات — الحالي مقابل السابق" current={totals.reviews} previous={prevTotals.reviews} />
          <ComparisonDonut title="متوسط التقييم — الحالي مقابل السابق" current={totals.average_rating} previous={prevTotals.average_rating} formatValue={(v) => v.toFixed(2)} />
        </div>

        <div className="monthly-print-bottom-insight">
          <div>
            <span>أعلى 10 فنادق — الحجوزات</span>
            <strong>{formatNumber(bookingTop)}</strong>
          </div>
          <div>
            <span>أقل 10 فنادق — الحجوزات</span>
            <strong>{formatNumber(bookingBottom)}</strong>
          </div>
          <div>
            <span>إجمالي الإيراد الحالي</span>
            <strong>{formatNumber(totals.actual_revenue, 2)}</strong>
          </div>
        </div>

        <div className="monthly-print-footer">
          <span>Current vs Previous Month</span>
          <strong>3 / 4</strong>
          <small>{previousPeriodLabel}</small>
        </div>
      </section>

      <section className="monthly-print-page monthly-print-page-four">
        <div className="monthly-print-section-heading detail">
          <div>
            <span>DETAILED WRITTEN REPORT</span>
            <h2>التقرير المكتوب التفصيلي</h2>
          </div>
          <small>{heroDate} — {selectedHotelName}</small>
        </div>

        <div className="monthly-print-detail-panel">
          <div className="monthly-print-detail-heading">
            <strong>تفاصيل أداء جميع الفنادق</strong>
            <span>الحجوزات • المدفوع • الكاش • السعر الإجمالي • التقييمات • متوسط التقييم</span>
          </div>
          <table className="monthly-print-detail-table">
            <thead>
              <tr>
                <th>الفندق</th>
                <th>الحجوزات</th>
                <th>مدفوع</th>
                <th>كاش</th>
                <th>السعر الإجمالي</th>
                <th>التقييمات</th>
                <th>متوسط التقييم</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((row: any) => (
                <tr key={row.hotel_name}>
                  <td>{row.hotel_name}</td>
                  <td>{formatNumber(num(row.bookings))}</td>
                  <td>{formatNumber(num(row.paid))}</td>
                  <td>{formatNumber(num(row.cash))}</td>
                  <td>{formatNumber(num(row.actual_revenue), 2)}</td>
                  <td>{formatNumber(num(row.review_count))}</td>
                  <td>{num(row.average_rating).toFixed(2)}</td>
                </tr>
              )) : (
                <tr><td colSpan={10} className="monthly-print-detail-empty">لا توجد بيانات لهذه الفترة.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="monthly-print-detail-note">
          التقرير يعرض البيانات الحالية للفترة المحددة مع الحفاظ على جميع الفنادق المسجلة، بما فيها الفنادق التي لا تحتوي على حركة خلال الشهر.
        </div>

        <div className="monthly-print-footer">
          <span>رؤية أوضح .. قرارات أسرع .. أداء أفضل</span>
          <strong>4 / 4</strong>
          <small>HOTEL PERFORMANCE SYSTEM — Confidential Report</small>
        </div>
      </section>
    </div>
  )
}

export default function MonthlyReport() {
  const now = new Date()
  const [y, setY] = useState(now.getFullYear())
  const [m, setM] = useState(now.getMonth() + 1)
  const [hotelId, setHotelId] = useState('')
  const [data, setData] = useState<any>(null)
  const [hotels, setHotels] = useState<Hotel[]>([])

  const load = () => {
    getMonthly(y, m, hotelId ? Number(hotelId) : undefined).then(setData)
  }

  useEffect(() => {
    getHotels().then(setHotels)
  }, [])

  useEffect(() => {
    load()
  }, [y, m, hotelId])

  const d =
    data || {
      rows: [],
      totals: {},
      platform_breakdown: {
        bookings: [],
        reviews: [],
        revenue: [],
      },
      previous: {
        rows: [],
        totals: {},
        year: previousMonth(y, m).year,
        month: previousMonth(y, m).month,
      },
    }

  const rows = Array.isArray(d.rows) ? d.rows : []
  const previousRows = Array.isArray(d.previous?.rows) ? d.previous.rows : []

  const totals = {
    bookings: num(d.totals?.bookings),
    paid: num(d.totals?.paid),
    cash: num(d.totals?.cash),
    actual_revenue: num(d.totals?.actual_revenue),
    commission: num(d.totals?.commission),
    tax: num(d.totals?.tax),
    net_revenue: num(d.totals?.net_revenue),
    reviews: num(d.totals?.reviews),
    average_rating: num(d.totals?.average_rating),
  }

  const prevTotals = {
    bookings: num(d.previous?.totals?.bookings),
    paid: num(d.previous?.totals?.paid),
    cash: num(d.previous?.totals?.cash),
    actual_revenue: num(d.previous?.totals?.actual_revenue),
    commission: num(d.previous?.totals?.commission),
    tax: num(d.previous?.totals?.tax),
    net_revenue: num(d.previous?.totals?.net_revenue),
    reviews: num(d.previous?.totals?.reviews),
    average_rating: num(d.previous?.totals?.average_rating),
  }

  const top10 = useMemo(
    () =>
      [...rows]
        .filter((r) => num(r.bookings) > 0)
        .sort((a, b) => num(b.bookings) - num(a.bookings))
        .slice(0, 10),
    [rows],
  )

  const topBookingHotelNames = useMemo(
    () => new Set(top10.map((r) => String(r.hotel_name || ''))),
    [top10],
  )

  const bottom10 = useMemo(
    () =>
      [...rows]
        .filter((r) => !topBookingHotelNames.has(String(r.hotel_name || '')))
        .sort((a, b) => num(a.bookings) - num(b.bookings))
        .slice(0, 10),
    [rows, topBookingHotelNames],
  )

  const currentRevenue = useMemo(
    () =>
      [...rows]
        .filter((r) => num(r.actual_revenue) > 0)
        .sort((a, b) => num(b.actual_revenue) - num(a.actual_revenue))
        .slice(0, 10),
    [rows],
  )

  const currentRevenueHotelNames = useMemo(
    () => new Set(currentRevenue.map((r) => String(r.hotel_name || ''))),
    [currentRevenue],
  )

  const bottomRevenue = useMemo(
    () =>
      [...rows]
        .filter((r) => !currentRevenueHotelNames.has(String(r.hotel_name || '')))
        .sort((a, b) => num(a.actual_revenue) - num(b.actual_revenue))
        .slice(0, 10),
    [rows, currentRevenueHotelNames],
  )

  const previousRevenue = useMemo(
    () =>
      [...previousRows]
        .filter((r) => num(r.actual_revenue) > 0)
        .sort((a, b) => num(b.actual_revenue) - num(a.actual_revenue))
        .slice(0, 10),
    [previousRows],
  )

  const ratedRows = useMemo(
    () =>
      [...rows]
        .filter((r) => num(r.review_count) > 0),
    [rows],
  )

  const currentRatings = useMemo(
    () =>
      [...ratedRows]
        .sort((a, b) => num(b.average_rating) - num(a.average_rating))
        .slice(0, 10),
    [ratedRows],
  )

  const currentRatingHotelNames = useMemo(
    () => new Set(currentRatings.map((r) => String(r.hotel_name || ''))),
    [currentRatings],
  )

  const bottomRatings = useMemo(
    () =>
      [...ratedRows]
        .filter((r) => !currentRatingHotelNames.has(String(r.hotel_name || '')))
        .sort((a, b) => num(a.average_rating) - num(b.average_rating))
        .slice(0, 10),
    [ratedRows, currentRatingHotelNames],
  )

  const previousRatings = useMemo(
    () =>
      [...previousRows]
        .filter((r) => num(r.review_count) > 0)
        .sort((a, b) => num(b.average_rating) - num(a.average_rating))
        .slice(0, 10),
    [previousRows],
  )

  const bookingTop = top10.reduce((s, r) => s + num(r.bookings), 0)
  const bookingBottom = bottom10.reduce((s, r) => s + num(r.bookings), 0)

  const previousPeriod = d.previous
    ? {
        year: num(d.previous.year) || previousMonth(y, m).year,
        month: num(d.previous.month) || previousMonth(y, m).month,
      }
    : previousMonth(y, m)

  const selectedHotelName = hotelId
    ? hotels.find((h) => String(h.id) === String(hotelId))?.name || 'الفندق المحدد'
    : 'كل الفنادق'

  const heroDate = monthLabel(y, m)

  return (
    <section className="page monthly-report-page">
      <div className="page-head">
        <div>
          <h2>التقرير الشهري</h2>
          <p>{heroDate} — ملخص + المقارنات + التقرير التفصيلي</p>
        </div>

        <div className="actions no-print">
          <button className="btn primary" onClick={load}>
            عرض التقرير
          </button>
          <PrintButton />
        </div>
      </div>

      <div className="home-hero monthly-report-hero print-friendly">
        <div className="home-hero-overlay" />

        <div className="home-hero-content">
          <div className="home-hero-eyebrow">HOTEL PERFORMANCE SYSTEM</div>
          <h2>التقرير الشهري</h2>
          <p>ملخص تنفيذي .. مقارنات دقيقة .. قراءة أوضح للأداء</p>
        </div>

        <div className="home-hero-date">
          <span>الفترة</span>
          <strong>{heroDate}</strong>
          <CalendarDays size={24} strokeWidth={1.8} />
        </div>
      </div>

      <div className="filters no-print dashboard-filters monthly-filters">
        <label>
          السنة
          <input
            type="number"
            min="2000"
            max="2100"
            value={y}
            onChange={(e) => setY(Number(e.target.value))}
          />
        </label>

        <label>
          الشهر
          <select value={m} onChange={(e) => setM(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {monthName(i + 1)}
              </option>
            ))}
          </select>
        </label>

        <label>
          الفندق
          <select value={hotelId} onChange={(e) => setHotelId(e.target.value)}>
            <option value="">كل الفنادق</option>
            {hotels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="stats monthly-premium-stats">
        <StatCard
          title="الحجوزات"
          value={totals.bookings}
          icon={<CalendarDays size={23} strokeWidth={2.2} />}
          accentColor="cyan"
          sparklineData={[2, 3, 2, 4, 4, 3, 5, 5]}
        />

        <StatCard
          title="الحجوزات المدفوعة"
          value={totals.paid}
          icon={<CreditCard size={23} strokeWidth={2.2} />}
          accentColor="violet"
          sparklineData={[1, 2, 2, 3, 2, 4, 4, 5]}
        />

        <StatCard
          title="الحجوزات الكاش"
          value={totals.cash}
          icon={<Users size={23} strokeWidth={2.2} />}
          accentColor="orange"
          sparklineData={[1, 1, 2, 2, 3, 2, 4, 3]}
        />

        <StatCard
          title="السعر الإجمالي"
          value={totals.actual_revenue}
          icon={<BarChart3 size={23} strokeWidth={2.2} />}
          accentColor="blue"
          sparklineData={[1, 2, 2, 3, 3, 4, 5, 5]}
        />

        <StatCard
          title="التقييمات"
          value={totals.reviews}
          icon={<Star size={23} strokeWidth={2.2} />}
          accentColor="pink"
          sparklineData={[2, 2, 3, 2, 4, 3, 4, 5]}
        />

        <StatCard
          title="متوسط التقييم"
          value={totals.average_rating}
          unit="/10"
          icon={<Star size={23} strokeWidth={2.2} />}
          accentColor="pink"
          sparklineData={[3, 4, 4, 5, 4, 5, 5, 6]}
        />
      </div>

      <section className="monthly-summary-strip print-friendly">
        <div>
          <span>الفترة الحالية</span>
          <strong>{monthLabel(y, m)}</strong>
        </div>

        <div>
          <span>الفترة السابقة</span>
          <strong>{monthLabel(previousPeriod.year, previousPeriod.month)}</strong>
        </div>

        <div>
          <span>النطاق</span>
          <strong>{selectedHotelName}</strong>
        </div>

        <div>
          <span>إجمالي الإيراد</span>
          <strong>
            {totals.actual_revenue.toLocaleString('en-US', {
              maximumFractionDigits: 2,
            })}
          </strong>
        </div>

        <div>
          <span>متوسط التقييم</span>
          <strong>{totals.average_rating.toFixed(2)} /10</strong>
        </div>

        <div>
          <span>إجمالي التقييمات</span>
          <strong>{totals.reviews.toLocaleString('en-US')}</strong>
        </div>

        <CircleDollarSign
          className="monthly-summary-icon"
          size={28}
          strokeWidth={1.8}
        />
      </section>

      <section className="monthly-chart-section print-friendly">
        <div className="monthly-section-head">
          <h3>أداء الفنادق — الحجوزات</h3>
          <span>مقارنة أعلى 10 وأقل 10 فنادق</span>
        </div>

        <div className="monthly-chart-pair">
          <HorizontalBars
            title="أعلى 10 فنادق — الحجوزات"
            data={top10.map((r: any) => ({
              name: r.hotel_name,
              value: num(r.bookings),
            }))}
            maxItems={10}
          />

          <HorizontalBars
            title="أقل 10 فنادق — الحجوزات"
            data={bottom10.map((r: any) => ({
              name: r.hotel_name,
              value: num(r.bookings),
            }))}
            maxItems={10}
          />
        </div>
      </section>

      <section className="monthly-chart-section print-friendly">
        <div className="monthly-section-head">
          <h3>أداء الفنادق — إجمالي الإيرادات</h3>
          <span>
            الحالي: {monthLabel(y, m)} — السابق:{' '}
            {monthLabel(previousPeriod.year, previousPeriod.month)}
          </span>
        </div>

        <div className="monthly-chart-pair">
          <HorizontalBars
            title={`إجمالي الإيرادات — ${monthLabel(y, m)}`}
            data={currentRevenue.map((r: any) => ({
              name: r.hotel_name,
              value: num(r.actual_revenue),
            }))}
            maxItems={10}
          />

          <HorizontalBars
            title={`إجمالي الإيرادات — ${monthLabel(
              previousPeriod.year,
              previousPeriod.month,
            )}`}
            data={previousRevenue.map((r: any) => ({
              name: r.hotel_name,
              value: num(r.actual_revenue),
            }))}
            maxItems={10}
          />
        </div>
      </section>

      <section className="monthly-chart-section print-friendly">
        <div className="monthly-section-head">
          <h3>مؤشرات التقييم</h3>
          <span>متوسط التقييم حسب الفندق — الحالي والسابق</span>
        </div>

        <div className="monthly-chart-pair">
          <HorizontalBars
            title={`مؤشرات التقييم — ${monthLabel(y, m)}`}
            data={currentRatings.map((r: any) => ({
              name: r.hotel_name,
              value: num(r.average_rating),
            }))}
            maxItems={10}
            valueSuffix=" /10"
          />

          <HorizontalBars
            title={`مؤشرات التقييم — ${monthLabel(
              previousPeriod.year,
              previousPeriod.month,
            )}`}
            data={previousRatings.map((r: any) => ({
              name: r.hotel_name,
              value: num(r.average_rating),
            }))}
            maxItems={10}
            valueSuffix=" /10"
          />
        </div>
      </section>

      <section className="monthly-donut-section print-friendly">
        <div className="monthly-section-head">
          <h3>توزيع الأداء حسب المنصة</h3>
          <span>نسبة الحجوزات والتقييمات والسعر الإجمالي في الشهر المحدد</span>
        </div>

        <div className="monthly-platform-grid">
          <PlatformShareChart
            title="الحجوزات حسب المنصة"
            items={d.platform_breakdown?.bookings || []}
          />

          <PlatformShareChart
            title="التقييمات حسب المنصة"
            items={d.platform_breakdown?.reviews || []}
          />

          <PlatformShareChart
            title="السعر الإجمالي حسب المنصة"
            items={d.platform_breakdown?.revenue || []}
          />
        </div>
      </section>

      <section className="monthly-donut-section print-friendly">
        <div className="monthly-section-head">
          <h3>مؤشرات المقارنة</h3>
          <span>النسبة النسبية بين الفترتين</span>
        </div>

        <div className="monthly-donut-grid">
          <ComparisonDonut
            title="الحجوزات — أعلى 10 مقابل أقل 10"
            current={bookingTop}
            previous={bookingBottom}
            currentLabel="أعلى 10"
            previousLabel="أقل 10"
          />

          <ComparisonDonut
            title="إجمالي الإيراد — الحالي مقابل السابق"
            current={totals.actual_revenue}
            previous={prevTotals.actual_revenue}
            formatValue={(v) =>
              v.toLocaleString('en-US', {
                maximumFractionDigits: 2,
              })
            }
          />

          <ComparisonDonut
            title="متوسط التقييم — الحالي مقابل السابق"
            current={totals.average_rating}
            previous={prevTotals.average_rating}
            formatValue={(v) => v.toFixed(2)}
          />
        </div>
      </section>

      <section className="panel print-friendly monthly-detail-panel">
        <div className="report-section-title">
          <div>
            <h3>التقرير المكتوب التفصيلي</h3>
            <p className="detail-period-note">
              {monthLabel(y, m)}
              {hotelId ? ' — الفندق المحدد فقط' : ' — كل الفنادق'}
            </p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="monthly-detail-table">
            <thead>
              <tr>
                <th>الفندق</th>
                <th>الحجوزات</th>
                <th>مدفوع</th>
                <th>كاش</th>
                <th>السعر الإجمالي</th>
                <th>التقييمات</th>
                <th>متوسط التقييم</th>
              </tr>
            </thead>

            <tbody>
              {rows.length ? (
                rows.map((r: any) => (
                  <tr key={r.hotel_name}>
                    <td>{r.hotel_name}</td>
                    <td>{num(r.bookings)}</td>
                    <td>{num(r.paid)}</td>
                    <td>{num(r.cash)}</td>
                    <td>{num(r.actual_revenue).toFixed(2)}</td>
                    <td>{num(r.review_count)}</td>
                    <td>{num(r.average_rating).toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="empty-cell">
                    لا توجد بيانات لهذه الفترة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <MonthlyPrintReport
        heroDate={heroDate}
        previousPeriod={previousPeriod}
        selectedHotelName={selectedHotelName}
        totals={{ ...totals, __year: y, __month: m }}
        prevTotals={prevTotals}
        d={d}
        top10={top10}
        bottom10={bottom10}
        currentRevenue={currentRevenue}
        bottomRevenue={bottomRevenue}
        previousRevenue={previousRevenue}
        currentRatings={currentRatings}
        bottomRatings={bottomRatings}
        previousRatings={previousRatings}
        rows={rows}
        bookingTop={bookingTop}
        bookingBottom={bookingBottom}
      />
    </section>
  )
}
