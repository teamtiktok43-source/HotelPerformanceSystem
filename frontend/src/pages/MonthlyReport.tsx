import { useEffect, useState } from 'react'
import { getMonthly } from '../api'
import Stat from '../components/StatCard'
import Print from '../components/PrintButton'
import { DonutChart, HorizontalBars, ProgressList } from '../components/ReportCharts'

function monthName(m: number) {
  return new Intl.DateTimeFormat('ar-EG', { month: 'long' }).format(new Date(2024, m - 1, 1))
}

const num = (value: any) => Number.isFinite(Number(value)) ? Number(value) : 0

export default function MonthlyReport() {
  const now = new Date()
  const [y, setY] = useState(now.getFullYear())
  const [m, setM] = useState(now.getMonth() + 1)
  const [data, setData] = useState<any>(null)
  const load = () => getMonthly(y, m).then(setData)
  useEffect(() => { load() }, [])

  const d = data || { rows: [], totals: {} }
  const rows = Array.isArray(d.rows) ? d.rows : []
  const totals = {
    bookings: num(d.totals?.bookings), paid: num(d.totals?.paid), cash: num(d.totals?.cash),
    actual_revenue: num(d.totals?.actual_revenue), commission: num(d.totals?.commission),
    net_revenue: num(d.totals?.net_revenue), reviews: num(d.totals?.reviews), average_rating: num(d.totals?.average_rating),
  }

  return (
    <section className="page">
      <div className="page-head">
        <div><h2>التقرير الشهري</h2><p>{monthName(m)} {y} — ملخص + Charts + التقرير التفصيلي</p></div>
        <div className="actions no-print"><button className="btn primary" onClick={load}>عرض التقرير</button><Print /></div>
      </div>

      <div className="filters no-print">
        <label>السنة<input type="number" min="2000" max="2100" value={y} onChange={e => setY(Number(e.target.value))} /></label>
        <label>الشهر<select value={m} onChange={e => setM(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{monthName(i + 1)}</option>)}</select></label>
      </div>

      <div className="stats">
        <Stat title="الحجوزات" value={totals.bookings} />
        <Stat title="المدفوع" value={totals.paid} />
        <Stat title="الكاش" value={totals.cash} />
        <Stat title="الإيراد الفعلي" value={totals.actual_revenue} />
        <Stat title="العمولة" value={totals.commission} />
        <Stat title="صافي الإيراد" value={totals.net_revenue} />
        <Stat title="التقييمات" value={totals.reviews} />
        <Stat title="متوسط التقييم" value={totals.average_rating} />
      </div>

      <div className="report-chart-grid print-friendly visual-chart-grid monthly-visual-grid">
        <HorizontalBars title="أداء الفنادق — الحجوزات" data={rows.map((r: any) => ({ name: r.hotel_name, value: num(r.bookings) }))} maxItems={7} />
        <HorizontalBars title="أداء الفنادق — صافي الإيراد" data={rows.map((r: any) => ({ name: r.hotel_name, value: num(r.net_revenue) }))} maxItems={7} />
        <DonutChart title="مزيج المدفوع والكاش" paid={totals.paid} cash={totals.cash} />
        <ProgressList title="مؤشرات التقييم" max={100} items={[{ name: 'متوسط التقييم', value: totals.average_rating * 10 }, { name: 'عدد التقييمات', value: totals.reviews }]} formatter={(v) => `${Math.round(v)}${v === totals.reviews ? '' : '%'}`} />
      </div>

      <div className="panel print-friendly">
        <div className="report-section-title"><h3>التقرير المكتوب التفصيلي</h3></div>
        <div className="table-wrap"><table><thead><tr><th>الفندق</th><th>الحجوزات</th><th>مدفوع</th><th>كاش</th><th>الإيراد الفعلي</th><th>العمولة</th><th>الصافي</th><th>التقييمات</th><th>متوسط التقييم</th></tr></thead>
          <tbody>{rows.map((r: any) => <tr key={r.hotel_name}><td>{r.hotel_name}</td><td>{num(r.bookings)}</td><td>{num(r.paid)}</td><td>{num(r.cash)}</td><td>{num(r.actual_revenue).toFixed(2)}</td><td>{num(r.commission).toFixed(2)}</td><td>{num(r.net_revenue).toFixed(2)}</td><td>{num(r.review_count)}</td><td>{num(r.average_rating).toFixed(2)}</td></tr>)}</tbody>
        </table></div>
      </div>
    </section>
  )
}
