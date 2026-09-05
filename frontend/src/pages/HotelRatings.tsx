import { useEffect, useState } from 'react'
import { getRatings } from '../api'
import PrintButton from '../components/PrintButton'
import { useRealtime } from '../useRealtime'

function monthName(m: number) {
  return new Intl.DateTimeFormat('ar-EG', { month: 'long' }).format(new Date(2024, m - 1, 1))
}

export default function HotelRatings() {
  const tick = useRealtime()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rows, setRows] = useState<any[]>([])

  const load = () => getRatings(year, month).then(setRows)

  useEffect(() => { load() }, [tick])

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>تقييمات الفنادق</h2>
          <p>ملخص متوسط التقييم وعدد المراجعات والمشاعر حسب الشهر والسنة.</p>
        </div>
        <div className="actions no-print">
          <button className="btn secondary" onClick={load}>تحديث البيانات</button>
          <PrintButton />
        </div>
      </div>

      <div className="filters no-print">
        <label>السنة
          <input type="number" min="2000" max="2100" value={year} onChange={e => setYear(Number(e.target.value))} />
        </label>
        <label>الشهر
          <select value={month} onChange={e => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{monthName(i + 1)}</option>
            ))}
          </select>
        </label>
        <button className="btn primary" onClick={load}>عرض التقرير</button>
      </div>

      <div className="panel print-friendly">
        <div className="report-section-title">
          <h3>تقييمات الفنادق — {monthName(month)} {year}</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>الفندق</th>
                <th>عدد التقييمات</th>
                <th>متوسط التقييم</th>
                <th>إيجابي</th>
                <th>سلبي</th>
                <th>معلق/محايد</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map(r => (
                <tr key={r.hotel_id}>
                  <td>{r.hotel_name}</td>
                  <td>{r.review_count || 0}</td>
                  <td>{Number.isFinite(Number(r.average_rating)) ? Number(r.average_rating).toFixed(2) : '0.00'}</td>
                  <td>{r.positive || 0}</td>
                  <td>{r.negative || 0}</td>
                  <td>{r.pending || 0}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="empty-cell">لا توجد تقييمات لهذا الشهر.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
