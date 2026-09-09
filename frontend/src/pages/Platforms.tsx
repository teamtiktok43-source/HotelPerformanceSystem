import { useEffect, useState } from 'react'
import { createPlatform, getPlatforms, Platform, updatePlatform, User } from '../api'

export default function Platforms({ user }: { user: User }) {
  const [rows, setRows] = useState<Platform[]>([])
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<Platform | null>(null)
  const [editName, setEditName] = useState('')
  const [busy, setBusy] = useState(false)
  const canManage = user.role === 'admin' || user.role === 'manager'

  const load = () => getPlatforms().then(setRows).catch(() => setRows([]))
  useEffect(() => { load() }, [])

  async function add() {
    if (!name.trim()) return alert('اكتب اسم المنصة أولًا.')
    try {
      setBusy(true)
      await createPlatform({ name: name.trim(), active: true })
      setName('')
      await load()
    } catch (e: any) { alert(e?.message || 'تعذر إضافة المنصة') }
    finally { setBusy(false) }
  }

  function openEdit(p: Platform) { setEditing(p); setEditName(p.name) }

  async function saveEdit() {
    if (!editing || !editName.trim()) return
    try {
      setBusy(true)
      await updatePlatform(editing.id, { name: editName.trim() })
      setEditing(null)
      await load()
    } catch (e: any) { alert(e?.message || 'تعذر تعديل المنصة') }
    finally { setBusy(false) }
  }

  async function toggle(p: Platform) {
    try {
      setBusy(true)
      await updatePlatform(p.id, { active: !p.active })
      await load()
    } catch (e: any) { alert(e?.message || 'تعذر تغيير حالة المنصة') }
    finally { setBusy(false) }
  }

  return <section className="page">
    <div className="page-head"><div><h2>إدارة المنصات</h2><p>Booking.com و Expedia.com و Trip.com مع إمكانية إضافة أي منصة أخرى.</p></div></div>
    {canManage && <div className="form-card no-print platform-form">
      <div className="form-grid platform-add-grid">
        <label>اسم المنصة<input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: Agoda.com" /></label>
      </div>
      <button className="btn primary" onClick={add} disabled={busy}>{busy ? 'جارٍ التنفيذ...' : 'إضافة منصة'}</button>
    </div>}
    <div className="panel"><div className="platform-note">يتم حفظ المنصة مع كل حجز أو إيراد أو تقييم جديد، وتُستخدم لحساب نسب الأداء حسب المنصة.</div>
      <div className="table-wrap"><table><thead><tr><th>#</th><th>المنصة</th><th>الحالة</th><th className="no-print">إجراء</th></tr></thead>
      <tbody>{rows.map(p => <tr key={p.id}><td>{p.id}</td><td>{p.name}</td><td><span className={p.active ? 'platform-active' : 'platform-inactive'}>{p.active ? 'Active' : 'Inactive'}</span></td><td className="no-print">{canManage && <div className="action-row"><button className="mini" onClick={() => openEdit(p)}>تعديل</button><button className="mini" onClick={() => toggle(p)}>{p.active ? 'تعطيل' : 'تفعيل'}</button></div>}</td></tr>)}</tbody></table></div>
    </div>
    {editing && <div className="modal-backdrop no-print" onMouseDown={e => { if (e.target === e.currentTarget) setEditing(null) }}><div className="modal-card" dir="rtl"><div className="modal-head"><div><h3>تعديل المنصة</h3><p>يمكن تغيير الاسم بدون حذف السجلات التاريخية.</p></div><button className="modal-close" onClick={() => setEditing(null)}>×</button></div><label className="modal-single-label">اسم المنصة<input value={editName} onChange={e => setEditName(e.target.value)} /></label><div className="modal-actions"><button className="btn secondary" onClick={() => setEditing(null)}>إلغاء</button><button className="btn primary" onClick={saveEdit} disabled={busy}>حفظ التعديل</button></div></div></div>}
  </section>
}
