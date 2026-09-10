import { useEffect, useState } from 'react'
import { CheckCircle2, KeyRound, LockKeyhole, ShieldCheck, TimerReset } from 'lucide-react'
import { activateLicense, createLicenseKey, deactivateLicense, getLicense, LicenseInfo } from '../api'

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function License() {
  const [license, setLicense] = useState<LicenseInfo | null>(null)
  const [key, setKey] = useState('')
  const [generatedKey, setGeneratedKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  async function load() {
    try {
      setLicense(await getLicense())
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل حالة الترخيص')
    }
  }

  useEffect(() => { load() }, [])

  async function generate() {
    setBusy(true); setMessage(''); setError('')
    try {
      const r = await createLicenseKey()
      setGeneratedKey(r.activation_key)
      setKey(r.activation_key)
      setMessage('تم إنشاء مفتاح تفعيل جديد. احتفظ به أو استخدمه الآن.')
    } catch (e: any) {
      setError(e?.message || 'تعذر إنشاء مفتاح التفعيل')
    } finally { setBusy(false) }
  }

  async function deactivate() {
    setBusy(true); setMessage(''); setError('')
    try {
      const r = await deactivateLicense()
      setLicense(r.license)
      setMessage('تم إلغاء تفعيل النظام بنجاح. يلزم تفعيل جديد لإعادة تشغيله للمستخدمين.')
      setConfirmDeactivate(false)
    } catch (e: any) {
      setError(e?.message || 'تعذر إلغاء تفعيل النظام')
    } finally { setBusy(false) }
  }

  async function activate() {
    if (!key.trim()) { setError('أدخل مفتاح التفعيل أولًا.'); return }
    setBusy(true); setMessage(''); setError('')
    try {
      const r = await activateLicense(key.trim())
      setLicense(r.license)
      setMessage('تم تفعيل النظام لمدة 30 يومًا بنجاح.')
      setGeneratedKey('')
      setKey('')
    } catch (e: any) {
      setError(e?.message || 'تعذر تفعيل النظام')
    } finally { setBusy(false) }
  }

  return (
    <section className="page license-page">
      <div className="page-head">
        <div>
          <h2>إدارة ترخيص النظام</h2>
          <p>هذه الصفحة متاحة لمالك النظام فقط للتحكم في مدة التفعيل.</p>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="license-hero">
        <div className="license-hero-icon"><ShieldCheck size={34} strokeWidth={1.8} /></div>
        <div>
          <div className="eyebrow">HOTEL PERFORMANCE SYSTEM</div>
          <h3>حماية النظام والترخيص</h3>
          <p>المالك الوحيد للنظام هو الحساب الرئيسي المرتبط بـ User ID 1.</p>
        </div>
      </div>

      <div className="license-grid">
        <div className="license-card">
          <div className="license-card-icon"><TimerReset size={24} /></div>
          <span>حالة الترخيص</span>
          <strong className={license?.active ? 'license-active' : 'license-expired'}>{license?.active ? 'مفعل' : 'منتهي'}</strong>
          <small>{license?.active ? `${license.remaining_days} يوم متبقي` : 'يجب تفعيل ترخيص جديد'}</small>
        </div>
        <div className="license-card">
          <div className="license-card-icon"><LockKeyhole size={24} /></div>
          <span>بداية التفعيل</span>
          <strong>{formatDate(license?.activated_at ?? null)}</strong>
          <small>مدة الترخيص 30 يومًا</small>
        </div>
        <div className="license-card">
          <div className="license-card-icon"><CheckCircle2 size={24} /></div>
          <span>تاريخ الانتهاء</span>
          <strong>{formatDate(license?.expires_at ?? null)}</strong>
          <small>بعد الانتهاء يُمنع دخول باقي المستخدمين</small>
        </div>
      </div>

      <div className="license-actions-panel">
        <div className="license-panel-head">
          <div>
            <h3>إنشاء مفتاح تفعيل</h3>
            <p>يتم إنشاء مفتاح عشوائي قوي مرة واحدة وتخزين نسخة مشفرة منه.</p>
          </div>
          <div className="license-panel-actions">
            <button className="btn primary" onClick={generate} disabled={busy}>
              <KeyRound size={18} /> إنشاء مفتاح جديد
            </button>
            {license?.active && (
              <button className="btn danger" onClick={() => setConfirmDeactivate(true)} disabled={busy}>
                <TimerReset size={18} /> إلغاء التفعيل
              </button>
            )}
          </div>
        </div>

        {confirmDeactivate && license?.active && (
          <div className="license-confirm">
            <div>
              <strong>إلغاء تفعيل النظام الآن؟</strong>
              <p>سيتم إيقاف دخول المستخدمين الآخرين فورًا، وسيحتاج النظام إلى تفعيل جديد للعودة للعمل.</p>
            </div>
            <div className="license-confirm-actions">
              <button className="btn danger" onClick={deactivate} disabled={busy}>تأكيد إلغاء التفعيل</button>
              <button className="btn" onClick={() => setConfirmDeactivate(false)} disabled={busy}>إلغاء</button>
            </div>
          </div>
        )}

        {generatedKey && (
          <div className="generated-key">
            <span>مفتاح التفعيل الجديد</span>
            <code>{generatedKey}</code>
          </div>
        )}

        <div className="activate-row">
          <label>
            مفتاح التفعيل
            <input value={key} onChange={e => setKey(e.target.value.toUpperCase())} placeholder="HPS-XXXX-XXXX-XXXX-XXXX" />
          </label>
          <button className="btn primary" onClick={activate} disabled={busy}>تفعيل 30 يوم</button>
        </div>
      </div>

      <div className="license-note panel">
        <strong>ملاحظة أمنية</strong>
        <p>تاريخ الانتهاء والتحقق من الترخيص يتمان من الخادم وقاعدة البيانات، وليس من جهاز المستخدم أو المتصفح.</p>
      </div>
    </section>
  )
}
