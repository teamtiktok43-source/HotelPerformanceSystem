import { useEffect, useState } from 'react'
import { CheckCircle2, KeyRound, LockKeyhole, Save, ShieldCheck, TimerReset } from 'lucide-react'
import {
  activateLicense,
  createLicenseKey,
  deactivateLicense,
  getLicense,
  LicenseInfo,
  updateLicenseSettings,
} from '../api'

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
  const [renewalPrice, setRenewalPrice] = useState('20')
  const [renewalCurrency, setRenewalCurrency] = useState('USD')
  const [suspensionTitle, setSuspensionTitle] = useState('Service Temporarily Suspended')
  const [suspensionMessage, setSuspensionMessage] = useState('The Hotel Performance System subscription is currently inactive. Please contact the system administrator to restore access.')

  function syncSettings(info: LicenseInfo) {
    setRenewalPrice(String(info.renewal_price ?? 20))
    setRenewalCurrency(info.renewal_currency || 'USD')
    setSuspensionTitle(info.suspension_title || 'Service Temporarily Suspended')
    setSuspensionMessage(info.suspension_message || 'The Hotel Performance System subscription is currently inactive. Please contact the system administrator to restore access.')
  }

  async function load() {
    try {
      const info = await getLicense()
      setLicense(info)
      syncSettings(info)
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل حالة الترخيص')
    }
  }

  useEffect(() => { load() }, [])

  async function saveSettings() {
    const price = Number(renewalPrice)
    if (!Number.isFinite(price) || price <= 0) {
      setError('أدخل قيمة تجديد صحيحة أكبر من صفر.')
      return
    }
    if (!renewalCurrency.trim()) {
      setError('أدخل رمز العملة.')
      return
    }
    if (!suspensionTitle.trim() || !suspensionMessage.trim()) {
      setError('عنوان ورسالة شاشة التعليق مطلوبان.')
      return
    }

    setBusy(true); setMessage(''); setError('')
    try {
      const r = await updateLicenseSettings({
        renewal_price: price,
        renewal_currency: renewalCurrency.trim().toUpperCase(),
        suspension_title: suspensionTitle.trim(),
        suspension_message: suspensionMessage.trim(),
      })
      setLicense(r.license)
      syncSettings(r.license)
      setMessage('تم حفظ إعدادات شاشة تعليق النظام بنجاح.')
    } catch (e: any) {
      setError(e?.message || 'تعذر حفظ إعدادات شاشة التعليق')
    } finally { setBusy(false) }
  }

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
      syncSettings(r.license)
      setMessage('تم تعليق النظام للمستخدمين. ستظهر لهم شاشة الاشتراك حتى إعادة التفعيل.')
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
      syncSettings(r.license)
      setMessage('تم تفعيل النظام لمدة 30 يومًا بنجاح. ستعود صفحة الدخول الطبيعية للمستخدمين.')
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
          <p>هذه الصفحة متاحة لمالك النظام فقط للتحكم في التفعيل وشاشة تعليق الخدمة.</p>
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
          <strong className={license?.active ? 'license-active' : 'license-expired'}>{license?.active ? 'مفعل' : 'معلق'}</strong>
          <small>{license?.active ? `${license.remaining_days} يوم متبقي` : 'صفحة الدخول العادية متوقفة للمستخدمين'}</small>
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

      <div className="license-actions-panel suspension-settings-panel">
        <div className="license-panel-head">
          <div>
            <h3>شاشة تعليق النظام</h3>
            <p>هذه البيانات تظهر للمستخدمين عندما يكون الترخيص غير مفعل.</p>
          </div>
          <button className="btn primary" onClick={saveSettings} disabled={busy}>
            <Save size={18} /> حفظ الإعدادات
          </button>
        </div>

        <div className="suspension-settings-grid">
          <label>
            قيمة التجديد
            <input type="number" min="0.01" step="0.01" value={renewalPrice} onChange={e => setRenewalPrice(e.target.value)} />
          </label>
          <label>
            العملة
            <input value={renewalCurrency} onChange={e => setRenewalCurrency(e.target.value.toUpperCase())} maxLength={10} placeholder="USD" />
          </label>
          <label className="span-2">
            عنوان شاشة التعليق
            <input value={suspensionTitle} onChange={e => setSuspensionTitle(e.target.value)} maxLength={160} />
          </label>
          <label className="span-2">
            رسالة المستخدمين
            <textarea value={suspensionMessage} onChange={e => setSuspensionMessage(e.target.value)} maxLength={1000} rows={3} />
          </label>
        </div>

        <div className="suspension-settings-preview">
          <span>معاينة مختصرة</span>
          <strong>{suspensionTitle || 'Service Temporarily Suspended'}</strong>
          <p>{suspensionMessage}</p>
          <b>{renewalCurrency === 'USD' ? '$' : ''}{renewalPrice || '20'} {renewalCurrency !== 'USD' ? renewalCurrency : ''} / month</b>
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
                <TimerReset size={18} /> تعليق النظام
              </button>
            )}
          </div>
        </div>

        {confirmDeactivate && license?.active && (
          <div className="license-confirm">
            <div>
              <strong>تعليق النظام الآن؟</strong>
              <p>سيتم منع باقي المستخدمين فورًا، وستظهر لهم شاشة تعليق الخدمة وقيمة التجديد التي حددتها بالأعلى. حساب المالك سيظل قادرًا على الدخول.</p>
            </div>
            <div className="license-confirm-actions">
              <button className="btn danger" onClick={deactivate} disabled={busy}>تأكيد التعليق</button>
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
        <p>التحقق من الترخيص يتم من الخادم وقاعدة البيانات. عند التعليق لا يستطيع أي مستخدم غير المالك تجاوز المنع باستدعاء الـ API مباشرة.</p>
      </div>
    </section>
  )
}
