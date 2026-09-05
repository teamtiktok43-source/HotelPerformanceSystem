import { useEffect, useState } from 'react';
import { Hotel, User, createHotel, getHotels, updateHotel } from '../api';

type EditState = {
  name: string;
  rate: string;
  active: boolean;
};

export default function Hotels({ user }: { user: User }) {
  const [rows, setRows] = useState<Hotel[]>([]);
  const [name, setName] = useState('');
  const [rate, setRate] = useState('0');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditState>({ name: '', rate: '0', active: true });
  const [busy, setBusy] = useState(false);
  const canManage = user.role === 'admin' || user.role === 'manager';

  const load = async () => {
    try {
      setRows(await getHotels());
    } catch (error) {
      alert(error instanceof Error ? error.message : 'حدث خطأ أثناء تحميل الفنادق');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  async function add() {
    const trimmed = name.trim();
    const numericRate = Number(rate);

    if (!trimmed) {
      alert('اكتب اسم الفندق.');
      return;
    }
    if (!Number.isFinite(numericRate) || numericRate < 0 || numericRate > 100) {
      alert('نسبة العمولة يجب أن تكون بين 0 و100%.');
      return;
    }

    try {
      setBusy(true);
      await createHotel({
        name: trimmed,
        commission_rate: numericRate / 100,
        active: true,
      });
      setName('');
      setRate('0');
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر إضافة الفندق');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(hotel: Hotel) {
    setEditingId(hotel.id);
    setEdit({
      name: hotel.name,
      rate: String((hotel.commission_rate * 100).toFixed(2)),
      active: hotel.active,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEdit({ name: '', rate: '0', active: true });
  }

  async function saveEdit(id: number) {
    const trimmed = edit.name.trim();
    const numericRate = Number(edit.rate);

    if (!trimmed) {
      alert('اسم الفندق لا يمكن أن يكون فارغًا.');
      return;
    }
    if (!Number.isFinite(numericRate) || numericRate < 0 || numericRate > 100) {
      alert('نسبة العمولة يجب أن تكون بين 0 و100%.');
      return;
    }

    try {
      setBusy(true);
      await updateHotel(id, {
        name: trimmed,
        commission_rate: numericRate / 100,
        active: edit.active,
      });
      cancelEdit();
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر حفظ تعديل الفندق');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(hotel: Hotel) {
    try {
      setBusy(true);
      await updateHotel(hotel.id, { active: !hotel.active });
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر تغيير حالة الفندق');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>إدارة الفنادق والعمولات</h2>
          <p>إضافة وتعديل اسم الفندق ونسبة العمولة وحالة الفندق.</p>
        </div>
      </div>

      {canManage && (
        <div className="form-card no-print">
          <div className="form-grid">
            <label>
              اسم الفندق
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الفندق" />
            </label>
            <label>
              العمولة %
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </label>
          </div>
          <button className="btn primary" onClick={add} disabled={busy}>
            {busy ? 'جارٍ التنفيذ...' : 'إضافة فندق'}
          </button>
        </div>
      )}

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>اسم الفندق</th>
                <th>نسبة العمولة</th>
                <th>الحالة</th>
                <th className="no-print">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((hotel) => {
                const isEditing = editingId === hotel.id;
                return (
                  <tr key={hotel.id}>
                    <td>{hotel.id}</td>

                    {isEditing ? (
                      <>
                        <td>
                          <input
                            className="table-input"
                            value={edit.name}
                            onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className="table-input"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={edit.rate}
                            onChange={(e) => setEdit({ ...edit, rate: e.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            className="table-input"
                            value={edit.active ? 'active' : 'inactive'}
                            onChange={(e) =>
                              setEdit({ ...edit, active: e.target.value === 'active' })
                            }
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{hotel.name}</td>
                        <td>{(hotel.commission_rate * 100).toFixed(2)}%</td>
                        <td>{hotel.active ? 'Active' : 'Inactive'}</td>
                      </>
                    )}

                    <td className="no-print">
                      {canManage ? (
                        isEditing ? (
                          <div className="action-row">
                            <button className="mini primary-mini" onClick={() => void saveEdit(hotel.id)} disabled={busy}>
                              حفظ
                            </button>
                            <button className="mini" onClick={cancelEdit} disabled={busy}>
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <div className="action-row">
                            <button className="mini primary-mini" onClick={() => startEdit(hotel)} disabled={busy}>
                              تعديل
                            </button>
                            <button className="mini" onClick={() => void toggle(hotel)} disabled={busy}>
                              {hotel.active ? 'تعطيل' : 'تفعيل'}
                            </button>
                          </div>
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={5}>لا توجد فنادق حاليًا.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
