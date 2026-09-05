import { useEffect, useMemo, useState } from "react";
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
import { Link } from "react-router-dom";
import { getDashboard, getHotels, getRatings, Hotel } from "../api";
import StatCard from "../components/StatCard";
import PrintButton from "../components/PrintButton";
import { useRealtime } from "../useRealtime";

const CHART_COLORS = ["#176aa6", "#42a5d5", "#ef8f3d", "#2e9b64", "#8a63d2", "#d95f76"];

type Section = "all" | "bookings" | "revenue" | "reviews" | "ratings";

const sectionLabels: Record<Section, string> = {
  all: "الكل",
  bookings: "الحجوزات اليومية",
  revenue: "الإيرادات اليومية",
  reviews: "التقييمات",
  ratings: "تقييمات الفنادق",
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function shortHotelName(name: string) {
  return name.length > 20 ? `${name.slice(0, 19)}…` : name;
}

export default function Home() {
  const tick = useRealtime();
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(today.slice(0, 8) + "01");
  const [end, setEnd] = useState(today);
  const [hotelId, setHotelId] = useState("");
  const [section, setSection] = useState<Section>("all");
  const [data, setData] = useState<any>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);

  const load = () =>
    getDashboard(
      new URLSearchParams({
        start,
        end,
        ...(hotelId ? { hotel_id: hotelId } : {}),
      }).toString(),
    ).then(setData);

  useEffect(() => {
    getHotels().then(setHotels);
    getRatings().then(setRatings);
  }, []);

  useEffect(() => {
    load();
  }, [tick]);

  useEffect(() => {
    load();
  }, [start, end, hotelId]);

  const d = data ?? {
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
    revenue_by_hotel: [],
    paid_cash: [
      { name: "مدفوع", value: 0 },
      { name: "كاش", value: 0 },
    ],
    sentiment: [
      { name: "Positive", value: 0 },
      { name: "Negative", value: 0 },
      { name: "Neutral", value: 0 },
    ],
    hotel_performance: [],
  };

  const selectedSection = sectionLabels[section];

  const kpis = useMemo(() => {
    if (section === "bookings") {
      return [
        ["إجمالي الحجوزات", d.kpis.bookings],
        ["الحجوزات المدفوعة", d.kpis.paid_bookings],
        ["الحجوزات الكاش", d.kpis.cash_bookings],
      ];
    }
    if (section === "revenue") {
      return [
        ["الإيراد الفعلي", money(d.kpis.actual_revenue)],
        ["العمولة", money(d.kpis.commission)],
        ["صافي الإيراد", money(d.kpis.net_revenue)],
      ];
    }
    if (section === "reviews" || section === "ratings") {
      return [
        ["إجمالي التقييمات", d.kpis.reviews],
        ["متوسط التقييم", d.kpis.average_rating],
      ];
    }
    return [
      ["إجمالي التقييمات", d.kpis.reviews],
      ["إجمالي الحجوزات", d.kpis.bookings],
      ["الحجوزات المدفوعة", d.kpis.paid_bookings],
      ["الحجوزات الكاش", d.kpis.cash_bookings],
      ["الإيراد الفعلي", money(d.kpis.actual_revenue)],
      ["العمولة", money(d.kpis.commission)],
      ["صافي الإيراد", money(d.kpis.net_revenue)],
      ["متوسط التقييم", d.kpis.average_rating],
    ];
  }, [section, d]);

  const revenueChart = (d.revenue_by_hotel || []).map((r: any) => ({
    ...r,
    label: shortHotelName(r.name),
  }));

  const performanceChart = (d.hotel_performance || []).slice(0, 15).map((r: any) => ({
    ...r,
    label: shortHotelName(r.hotel),
  }));

  const ratingsChart = ratings
    .filter((r) => !hotelId || String(r.hotel_id) === hotelId)
    .slice(0, 15)
    .map((r) => ({ name: shortHotelName(r.hotel_name), fullName: r.hotel_name, value: Number(r.average_rating || 0) }));

  const sentimentChart =
    (d.sentiment || []).length > 0
      ? d.sentiment
      : [
          { name: "Positive", value: 0 },
          { name: "Negative", value: 0 },
          { name: "Neutral", value: 0 },
        ];

  const actions = [
    ["التقييمات", "/reviews", "📝"],
    ["الحجوزات اليومية", "/bookings", "📅"],
    ["الإيرادات اليومية", "/revenue", "💵"],
    ["التقرير الشهري", "/monthly", "📊"],
  ];

  return (
    <section className="page dashboard-page">
      <div className="page-head">
        <div>
          <h2>لوحة أداء الفنادق</h2>
          <p>مركز التحكم التنفيذي والتقارير السريعة — {selectedSection}</p>
        </div>
        <div className="actions no-print">
          <button className="btn primary" onClick={load}>عرض التقرير</button>
          <button className="btn secondary" onClick={load}>تحديث البيانات</button>
          <PrintButton label="طباعة لوحة التقرير" />
        </div>
      </div>

      <div className="filters dashboard-filters no-print">
        <label>
          من تاريخ
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          إلى تاريخ
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <label>
          الفندق
          <select value={hotelId} onChange={(e) => setHotelId(e.target.value)}>
            <option value="">كل الفنادق</option>
            {hotels.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </label>
        <label>
          القسم
          <select value={section} onChange={(e) => setSection(e.target.value as Section)}>
            <option value="all">الكل</option>
            <option value="bookings">الحجوزات اليومية</option>
            <option value="revenue">الإيرادات اليومية</option>
            <option value="reviews">التقييمات</option>
            <option value="ratings">تقييمات الفنادق</option>
          </select>
        </label>
      </div>

      <div className={`stats stats-${kpis.length}`}>
        {kpis.map((x: any) => (
          <StatCard
            key={x[0]}
            title={x[0]}
            value={x[1]}
            unit={x[0] === "متوسط التقييم" ? "/10" : undefined}
          />
        ))}
      </div>

      <div className="quick-grid no-print">
        {actions.map(([label, to, icon]) => (
          <Link className="quick-card" to={to} key={to}>
            <span>{icon}</span>
            <b>فتح {label}</b>
          </Link>
        ))}
      </div>

      {(section === "all" || section === "revenue") && (
        <div className="dashboard-chart-grid print-friendly">
          <div className="panel chart-panel">
            <h3>صافي الإيراد حسب الفندق</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={revenueChart} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => money(v)} />
                <YAxis type="category" dataKey="label" width={110} />
                <Tooltip formatter={(v: any) => money(v)} />
                <Bar dataKey="value" name="صافي الإيراد" fill="#176aa6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel chart-panel">
            <h3>مزيج المدفوع والكاش</h3>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={d.paid_cash}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={105}
                  paddingAngle={3}
                  labelLine={false}
                  label={({ name, percent }: any) => `${name} ${Math.round((percent || 0) * 100)}%`}
                >
                  {d.paid_cash.map((_: any, i: number) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {(section === "all" || section === "bookings") && (
        <div className="dashboard-chart-grid print-friendly">
          <div className="panel chart-panel">
            <h3>أداء الفنادق — الحجوزات</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={performanceChart} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="bookings" name="الحجوزات" fill="#42a5d5" radius={[6, 6, 0, 0]} />
                <Bar dataKey="paid" name="مدفوع" fill="#2e9b64" radius={[6, 6, 0, 0]} />
                <Bar dataKey="cash" name="كاش" fill="#ef8f3d" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel chart-panel">
            <h3>أداء الحجوزات حسب الفندق</h3>
            <div className="dashboard-summary">
              <div className="dashboard-highlight">
                <span>إجمالي الحجوزات</span>
                <strong>{d.kpis.bookings}</strong>
              </div>
              <div className="dashboard-highlight">
                <span>مدفوع</span>
                <strong>{d.kpis.paid_bookings}</strong>
              </div>
              <div className="dashboard-highlight">
                <span>كاش</span>
                <strong>{d.kpis.cash_bookings}</strong>
              </div>
            </div>
            <p className="dashboard-note">استخدم جدول الأداء أسفل الصفحة لرؤية التفاصيل لكل فندق.</p>
          </div>
        </div>
      )}

      {(section === "all" || section === "reviews") && (
        <div className="dashboard-chart-grid print-friendly">
          <div className="panel chart-panel">
            <h3>اتجاه التقييمات</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={sentimentChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="عدد التقييمات">
                  {sentimentChart.map((r: any, i: number) => (
                    <Cell
                      key={r.name}
                      fill={
                        r.name.toLowerCase() === "positive"
                          ? "#2e9b64"
                          : r.name.toLowerCase() === "negative"
                            ? "#d95f76"
                            : CHART_COLORS[i % CHART_COLORS.length]
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel chart-panel">
            <h3>ملخص التقييمات</h3>
            <div className="dashboard-summary">
              <div className="dashboard-highlight">
                <span>عدد التقييمات</span>
                <strong>{d.kpis.reviews}</strong>
              </div>
              <div className="dashboard-highlight">
                <span>المتوسط</span>
                <strong>{d.kpis.average_rating}/10</strong>
              </div>
            </div>
            <p className="dashboard-note">تفاصيل المشاعر والحالات موجودة في صفحة التقييمات.</p>
          </div>
        </div>
      )}

      {section === "ratings" && (
        <div className="dashboard-chart-grid print-friendly">
          <div className="panel chart-panel">
            <h3>متوسط التقييم حسب الفندق</h3>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={ratingsChart} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 10]} />
                <YAxis type="category" dataKey="name" width={120} />
                <Tooltip formatter={(v: any) => `${Number(v || 0).toFixed(2)} / 10`} labelFormatter={(_, payload: any) => payload?.[0]?.payload?.fullName || ""} />
                <Bar dataKey="value" name="متوسط التقييم" fill="#8a63d2" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel chart-panel">
            <h3>ملخص تقييمات الفنادق</h3>
            <div className="dashboard-summary">
              <div className="dashboard-highlight">
                <span>الفنادق المقيمة</span>
                <strong>{ratings.filter((r) => !hotelId || String(r.hotel_id) === hotelId).length}</strong>
              </div>
              <div className="dashboard-highlight">
                <span>إجمالي التقييمات</span>
                <strong>{d.kpis.reviews}</strong>
              </div>
              <div className="dashboard-highlight">
                <span>المتوسط العام</span>
                <strong>{Number(d.kpis.average_rating || 0).toFixed(2)}/10</strong>
              </div>
            </div>
            <p className="dashboard-note">للتفاصيل الكاملة حسب الفندق استخدم صفحة تقييمات الفنادق.</p>
          </div>
        </div>
      )}

      <div className="panel print-friendly">
        <h3>
          {section === "revenue" ? "أداء الفنادق — الإيرادات" : section === "reviews" ? "أداء التقييمات" : "أداء الفنادق"}
        </h3>

        {section === "revenue" ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الفندق</th>
                  <th>صافي الإيراد</th>
                </tr>
              </thead>
              <tbody>
                {revenueChart.length ? revenueChart.map((r: any) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{money(r.value)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={2} className="empty-state">لا توجد بيانات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : section === "ratings" ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الفندق</th>
                  <th>عدد التقييمات</th>
                  <th>متوسط التقييم</th>
                  <th>إيجابي</th>
                  <th>سلبي</th>
                </tr>
              </thead>
              <tbody>
                {ratings.filter((r) => !hotelId || String(r.hotel_id) === hotelId).map((r: any) => (
                  <tr key={r.hotel_id}>
                    <td>{r.hotel_name}</td>
                    <td>{r.review_count}</td>
                    <td>{Number(r.average_rating || 0).toFixed(2)}</td>
                    <td>{r.positive}</td>
                    <td>{r.negative}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : section === "reviews" ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>المشاعر</th>
                  <th>العدد</th>
                </tr>
              </thead>
              <tbody>
                {sentimentChart.map((r: any) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الفندق</th>
                  <th>الحجوزات</th>
                  <th>مدفوع</th>
                  <th>كاش</th>
                </tr>
              </thead>
              <tbody>
                {(d.hotel_performance || []).length ? (
                  d.hotel_performance.map((r: any) => (
                    <tr key={r.hotel}>
                      <td>{r.hotel}</td>
                      <td>{r.bookings}</td>
                      <td>{r.paid}</td>
                      <td>{r.cash}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="empty-state">لا توجد بيانات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
