import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Coins,
  CreditCard,
  Hotel as HotelIcon,
  Receipt,
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
        .sort((a, b) => num(b.bookings) - num(a.bookings))
        .slice(0, 10),
    [rows],
  )

  const bottom10 = useMemo(
    () =>
      [...rows]
        .sort((a, b) => num(a.bookings) - num(b.bookings))
        .slice(0, 10),
    [rows],
  )

  const currentRevenue = useMemo(
    () =>
      [...rows]
        .filter((r) => num(r.net_revenue) > 0)
        .sort((a, b) => num(b.net_revenue) - num(a.net_revenue))
        .slice(0, 10),
    [rows],
  )

  const previousRevenue = useMemo(
    () =>
      [...previousRows]
        .filter((r) => num(r.net_revenue) > 0)
        .sort((a, b) => num(b.net_revenue) - num(a.net_revenue))
        .slice(0, 10),
    [previousRows],
  )

  const currentRatings = useMemo(
    () =>
      [...rows]
        .filter((r) => num(r.review_count) > 0)
        .sort((a, b) => num(b.average_rating) - num(a.average_rating))
        .slice(0, 10),
    [rows],
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
          title="العمولة"
          value={totals.commission}
          icon={<Coins size={23} strokeWidth={2.2} />}
          accentColor="green"
          sparklineData={[1, 1, 2, 2, 2, 3, 3, 4]}
        />

        <StatCard
          title="الضرائب"
          value={totals.tax}
          icon={<Receipt size={23} strokeWidth={2.2} />}
          accentColor="red"
          sparklineData={[1, 2, 1, 2, 1, 3, 2, 2]}
        />

        <StatCard
          title="صافي الإيراد"
          value={totals.net_revenue}
          icon={<HotelIcon size={23} strokeWidth={2.2} />}
          accentColor="purple"
          sparklineData={[2, 2, 3, 3, 4, 4, 5, 5]}
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
          <span>صافي الإيراد</span>
          <strong>
            {totals.net_revenue.toLocaleString('en-US', {
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
          <h3>أداء الفنادق — صافي الإيراد</h3>
          <span>
            الحالي: {monthLabel(y, m)} — السابق:{' '}
            {monthLabel(previousPeriod.year, previousPeriod.month)}
          </span>
        </div>

        <div className="monthly-chart-pair">
          <HorizontalBars
            title={`صافي الإيراد — ${monthLabel(y, m)}`}
            data={currentRevenue.map((r: any) => ({
              name: r.hotel_name,
              value: num(r.net_revenue),
            }))}
            maxItems={10}
          />

          <HorizontalBars
            title={`صافي الإيراد — ${monthLabel(
              previousPeriod.year,
              previousPeriod.month,
            )}`}
            data={previousRevenue.map((r: any) => ({
              name: r.hotel_name,
              value: num(r.net_revenue),
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
            title="صافي الإيراد — الحالي مقابل السابق"
            current={totals.net_revenue}
            previous={prevTotals.net_revenue}
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
                <th>العمولة</th>
                <th>الضرائب</th>
                <th>الصافي</th>
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
                    <td>{num(r.commission).toFixed(2)}</td>
                    <td>{num(r.tax).toFixed(2)}</td>
                    <td>{num(r.net_revenue).toFixed(2)}</td>
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
    </section>
  )
}
