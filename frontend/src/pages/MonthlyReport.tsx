import { useEffect, useState } from "react";
import { getMonthly } from "../api";
import StatCard from "../components/StatCard";
import PrintButton from "../components/PrintButton";
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
} from "recharts";

const COLORS = ["#176aa6", "#42a5d5", "#ef8f3d", "#2e9b64", "#8a63d2", "#d95f76"];

function monthName(m: number) {
  return new Intl.DateTimeFormat("ar-EG", { month: "long" }).format(new Date(2024, m - 1, 1));
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function shortHotelName(name: string) {
  return name.length > 18 ? `${name.slice(0, 17)}…` : name;
}

export default function MonthlyReport() {
  const now = new Date();
  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth() + 1);
  const [data, setData] = useState<any>(null);

  const load = () => getMonthly(y, m).then(setData);

  useEffect(() => {
    load();
  }, []);

  const d = data ?? { rows: [], totals: {} };
  const chartRows = (d.rows || []).slice(0, 15).map((r: any) => ({
    ...r,
    label: shortHotelName(r.hotel_name),
  }));

  const paidCash = [
    { name: "مدفوع", value: Number(d.totals.paid || 0) },
    { name: "كاش", value: Number(d.totals.cash || 0) },
  ];

  return (
    <section className="page report-page monthly-report">
      <div className="page-head">
        <div>
          <h2>التقرير الشهري</h2>
          <p>{monthName(m)} {y} — ملخص + Charts + التقرير التفصيلي</p>
        </div>
        <div className="actions no-print">
          <button className="btn primary" onClick={load}>عرض التقرير</button>
          <PrintButton label="طباعة التقرير" />
        </div>
      </div>

      <div className="filters no-print">
        <label>
          السنة
          <input type="number" value={y} onChange={(e) => setY(Number(e.target.value))} />
        </label>
        <label>
          الشهر
          <select value={m} onChange={(e) => setM(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{monthName(i + 1)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="stats stats-8">
        {[
          ["الحجوزات", d.totals.bookings],
          ["المدفوع", d.totals.paid],
          ["الكاش", d.totals.cash],
          ["الإيراد الفعلي", money(d.totals.actual_revenue)],
          ["العمولة", money(d.totals.commission)],
          ["صافي الإيراد", money(d.totals.net_revenue)],
          ["التقييمات", d.totals.reviews],
          ["متوسط التقييم", d.totals.average_rating],
        ].map((x: any) => (
          <StatCard
            key={x[0]}
            title={x[0]}
            value={x[1]}
            unit={x[0] === "متوسط التقييم" ? "/10" : undefined}
          />
        ))}
      </div>

      <div className="monthly-report-grid print-friendly">
        <div className="panel chart-panel">
          <h3>صافي الإيراد حسب الفندق</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartRows} layout="vertical" margin={{ left: 10, right: 10, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => money(v)} />
              <YAxis type="category" dataKey="label" width={105} />
              <Tooltip formatter={(v: any) => money(v)} />
              <Bar dataKey="net_revenue" name="صافي الإيراد" fill="#176aa6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel">
          <h3>الحجوزات حسب الفندق</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartRows} layout="vertical" margin={{ left: 10, right: 10, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={105} />
              <Tooltip />
              <Bar dataKey="bookings" name="الحجوزات" fill="#42a5d5" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel">
          <h3>مزيج المدفوع والكاش</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={paidCash}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={90}
                paddingAngle={3}
                label={({ name, percent }: any) => `${name} ${Math.round((percent || 0) * 100)}%`}
                labelLine={false}
              >
                {paidCash.map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel print-friendly">
        <div className="report-section-title">
          <div>
            <h3>التقرير المكتوب التفصيلي</h3>
            <p>جميع الفنادق مرتبة حسب صافي الإيراد</p>
          </div>
          <span className="report-count">{d.rows.length} فندق</span>
        </div>

        <div className="table-wrap">
          <table className="monthly-table">
            <thead>
              <tr>
                <th>الفندق</th>
                <th>الحجوزات</th>
                <th>مدفوع</th>
                <th>كاش</th>
                <th>الإيراد</th>
                <th>العمولة</th>
                <th>الصافي</th>
                <th>التقييمات</th>
                <th>متوسط التقييم</th>
              </tr>
            </thead>
            <tbody>
              {(d.rows || []).map((r: any) => (
                <tr key={r.hotel_name}>
                  <td>{r.hotel_name}</td>
                  <td>{r.bookings}</td>
                  <td>{r.paid}</td>
                  <td>{r.cash}</td>
                  <td>{money(r.actual_revenue)}</td>
                  <td>{money(r.commission)}</td>
                  <td>{money(r.net_revenue)}</td>
                  <td>{r.review_count}</td>
                  <td>{Number(r.average_rating || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>الإجمالي</th>
                <th>{d.totals.bookings || 0}</th>
                <th>{d.totals.paid || 0}</th>
                <th>{d.totals.cash || 0}</th>
                <th>{money(d.totals.actual_revenue)}</th>
                <th>{money(d.totals.commission)}</th>
                <th>{money(d.totals.net_revenue)}</th>
                <th>{d.totals.reviews || 0}</th>
                <th>{Number(d.totals.average_rating || 0).toFixed(2)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}
