import { useEffect, useState } from 'react';
import { createEmployee, deleteEmployee, getEmployees, updateEmployee, User } from '../api';

const emptyForm = { username: '', password: '', display_name: '', role: 'employee', active: true };

type FormState = typeof emptyForm;

export default function Employees({ user }: { user: User }) {
  const [rows, setRows] = useState<User[]>([]);
  const [f, setF] = useState<FormState>({ ...emptyForm });
  const [editing, setEditing] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ display_name: '', password: '', role: 'employee', active: true });
  const [busy, setBusy] = useState(false);

  const isAdmin = user.role === 'admin';
  const load = () => getEmployees().then(setRows).catch(() => setRows([]));

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!f.username.trim() || !f.password || !f.display_name.trim()) {
      alert('من فضلك املأ اسم المستخدم وكلمة المرور والاسم الظاهر.');
      return;
    }
    try {
      setBusy(true);
      await createEmployee({ ...f, active: true });
      setF({ ...emptyForm });
      await load();
    } catch (e: any) {
      alert(e?.message || 'تعذر إضافة الموظف');
    } finally {
      setBusy(false);
    }
  }

  function openEdit(u: User) {
    setEditing(u);
    setEditForm({
      display_name: u.display_name,
      password: '',
      role: u.role,
      active: u.active,
    });
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editForm.display_name.trim()) {
      alert('الاسم الظاهر لا يمكن أن يكون فارغًا.');
      return;
    }
    try {
      setBusy(true);
      const payload: any = {
        display_name: editForm.display_name.trim(),
        role: editForm.role,
        active: editForm.active,
      };
      if (editForm.password.trim()) payload.password = editForm.password.trim();
      await updateEmployee(editing.id, payload);
      setEditing(null);
      await load();
    } catch (e: any) {
      alert(e?.message || 'تعذر تعديل الموظف');
    } finally {
      setBusy(false);
    }
  }

  async function remove(u: User) {
    if (u.id === user.id) {
      alert('لا يمكن حذف الحساب المستخدم حاليًا.');
      return;
    }
    const ok = confirm(`هل أنت متأكد من حذف الموظف "${u.display_name}"؟\n\nلا يمكن التراجع عن الحذف.`);
    if (!ok) return;
    try {
      setBusy(true);
      await deleteEmployee(u.id);
      await load();
    } catch (e: any) {
      alert(e?.message || 'تعذر حذف الموظف. إذا كان مرتبطًا بسجلات سابقة استخدم تعطيل الحساب بدل الحذف.');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(u: User) {
    try {
      setBusy(true);
      await updateEmployee(u.id, { active: !u.active });
      await load();
    } catch (e: any) {
      alert(e?.message || 'تعذر تغيير حالة الموظف');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>إدارة الموظفين</h2>
          <p>المستخدمون والصلاحيات وحالة الحساب.</p>
        </div>
      </div>

      {isAdmin && (
        <div className="form-card no-print">
          <div className="form-grid">
            <label>اسم المستخدم<input value={f.username} onChange={e => setF({ ...f, username: e.target.value })} /></label>
            <label>كلمة المرور<input type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></label>
            <label>الاسم الظاهر<input value={f.display_name} onChange={e => setF({ ...f, display_name: e.target.value })} /></label>
            <label>الصلاحية<select value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select></label>
          </div>
          <button className="btn primary" onClick={add} disabled={busy}>إضافة موظف</button>
        </div>
      )}

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>المستخدم</th><th>الاسم</th><th>الصلاحية</th><th>الحالة</th><th className="no-print">إجراء</th></tr>
            </thead>
            <tbody>
              {rows.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>{u.display_name}</td>
                  <td>{u.role}</td>
                  <td>{u.active ? 'Active' : 'Inactive'}</td>
                  <td className="no-print">
                    {isAdmin && (
                      <div className="actions">
                        <button className="mini" onClick={() => openEdit(u)} disabled={busy}>تعديل</button>
                        <button className="mini" onClick={() => toggle(u)} disabled={busy}>{u.active ? 'تعطيل' : 'تفعيل'}</button>
                        <button className="mini mini-danger" onClick={() => remove(u)} disabled={busy}>حذف</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="modal-backdrop no-print" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="modal-card">
            <div className="modal-head">
              <div>
                <h3>تعديل الموظف</h3>
                <p>اسم المستخدم: {editing.username}</p>
              </div>
              <button className="modal-close" onClick={() => setEditing(null)}>×</button>
            </div>

            <div className="form-grid modal-grid">
              <label>الاسم الظاهر<input value={editForm.display_name} onChange={e => setEditForm({ ...editForm, display_name: e.target.value })} /></label>
              <label>الصلاحية<select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select></label>
              <label>كلمة مرور جديدة<input type="password" placeholder="اتركها فارغة بدون تغيير" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} /></label>
              <label>الحالة<select value={editForm.active ? 'active' : 'inactive'} onChange={e => setEditForm({ ...editForm, active: e.target.value === 'active' })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select></label>
            </div>

            <div className="modal-actions">
              <button className="btn primary" onClick={saveEdit} disabled={busy}>حفظ التعديل</button>
              <button className="btn secondary" onClick={() => setEditing(null)} disabled={busy}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
