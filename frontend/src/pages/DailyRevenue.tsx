import { FormEvent, useEffect, useState } from "react";
import { createRevenue, getEmployees, getHotels, Hotel, User, getRevenue } from "../api";
import PrintButton from "../components/PrintButton";
import { useRealtime } from "../useRealtime";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function shortHotelName(name: string) {
  return name.length > 18 ? `${name.slice(0, 17)}…` : name;
}

export default function DailyRevenue() {
  const tick = useRealtime();
  const today = new Date().toISOString().slice(0, 10);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [emps, setEmps] = useState<User[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({
    booking_number: "",
    hotel_id: "",
    platform: "Booking.com",
    revenue_date: today,
    actual_price: "",
    commissionable_amount: "",
    employee_id: "",
  });
  const [msg, setMsg] = useState("");

  const load = () => getRevenue().then(setRows);

  useEffect(() => {
    getHotels().then(setHotels);
    getEmployees().then(setEmps);
  }, []);

  useEffect(() => {
    load();
  }, [tick]);

  const hotel = hotels.find((h) => String(h.id) === form.hotel_id);
  const rate = hotel?.commission_rate ?? 0;
  const commission = Number(form.commissionable_amount || 0) * rate;
  const net = Number(form.actual_price || 0) - commission;

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await createRevenue({
        ...form,
        hotel_id: Number(form.hotel_id),
        actual_price: Number(form.actual_price),
        commissionable_amount: Number(form.commissionable_amount),
        employee_id: form.employee_id ? Number(form.employee_id) : undefined,
      });
      setMsg("تم حفظ الإيراد");
      setForm({ ...form, booking_number: "", actual_price: "", commissionable_amount: "" });
      load();
    } catch (ex: any) {
      setMsg(ex.message);
    }
  }

  const chart = rows.slice(0, 12).map((r) => ({
    name: shortHotelName(r.hotel_name),
    fullName: r.hotel_name,
    value: Number(r.net_revenue || 0),
  }));

  return (
    <section className="page report-page revenue-page">
      <div className="page-head">
        <div>
          <h2>الإيرادات اليومية</h2>
          <p>العمولة تُحتسب تلقائيًا حسب الفندق</p>
        </div>
        <div className="actions no-print">
          <PrintButton />
        </div>
      </div>

      <form className="form-card no-print" onSubmit={save}>
        <div className="form-grid">
          <label>
            رقم الحجز
            <input required value={form.booking_number} onChange={(e) => setForm({ ...form, booking_number: e.target.value })} />
          </label>
          <label>
            الفندق
            <select required value={form.hotel_id} onChange={(e) => setForm({ ...form, hotel_id: e.target.value })}>
              <option value="">اختر الفندق</option>
              {hotels.filter((h) => h.active).map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </label>
          <label>
            المنصة
            <input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} />
          </label>
          <label>
            تاريخ الإيراد
            <input type="date" value={form.revenue_date} onChange={(e) => setForm({ ...form, revenue_date: e.target.value })} />
          </label>
          <label>
            السعر الفعلي
            <input type="number" min="0" step="0.01" value={form.actual_price} onChange={(e) => setForm({ ...form, actual_price: e.target.value })} />
          </label>
          <label>
            المبلغ الخاضع للعمولة
            <input type="number" min="0" step="0.01" value={form.commissionable_amount} onChange={(e) => setForm({ ...form, commissionable_amount: e.target.value })} />
          </label>
          <label>
            نسبة العمولة
            <input disabled value={`${(rate * 100).toFixed(2)}%`} />
          </label>
          <label>
            العمولة
            <input disabled value={commission.toFixed(2)} />
          </label>
          <label>
            صافي الإيراد
            <input disabled value={net.toFixed(2)} />
          </label>
          <label>
            الموظف
            <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
              <option value="">أنا</option>
              {emps.filter((e) => e.active).map((e) => (
                <option key={e.id} value={e.id}>{e.display_name}</option>
              ))}
            </select>
          </label>
        </div>
        <button className="btn primary">حفظ الإيراد</button>
        {msg && <span className="inline-msg">{msg}</span>}
      </form>

      <div className="revenue-report-grid print-friendly">
        <div className="panel">
          <h3>سجل الإيرادات</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الحجز</th>
                  <th>الفندق</th>
                  <th>الفعلي</th>
                  <th>العمولة</th>
                  <th>الصافي</th>
                  <th>الموظف</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.revenue_date}</td>
                    <td>{r.booking_number}</td>
                    <td>{r.hotel_name}</td>
                    <td>{money(r.actual_price)}</td>
                    <td>{money(r.commission)}</td>
                    <td>{money(r.net_revenue)}</td>
                    <td>{r.employee_name}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="empty-state">لا توجد بيانات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel chart-panel">
          <h3>صافي الإيراد حسب الفندق</h3>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={chart} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => money(v)} />
              <YAxis type="category" dataKey="name" width={110} />
              <Tooltip labelFormatter={(_, payload: any) => payload?.[0]?.payload?.fullName || ""} formatter={(v: any) => money(v)} />
              <Bar dataKey="value" name="صافي الإيراد" fill="#176aa6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
