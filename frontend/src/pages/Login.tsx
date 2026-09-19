import { FormEvent, useEffect, useState } from 'react'
import { Database, LockKeyhole, Server, ShieldAlert, UserRoundCog } from 'lucide-react'
import { apiFetch, getPublicLicense, PublicLicenseInfo, User } from '../api'

const fallbackSuspension: PublicLicenseInfo = {
  active: true,
  renewal_price: 20,
  renewal_currency: 'USD',
  suspension_title: 'Service Temporarily Suspended',
  suspension_message: 'The Hotel Performance System subscription is currently inactive. Please contact the system administrator to restore access.',
}

function LoginForm({
  onLogin,
  ownerMode = false,
  onBack,
}: {
  onLogin: (u: User, t: string) => void
  ownerMode?: boolean
  onBack?: () => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await apiFetch<any>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      onLogin(r.user, r.access_token)
    } catch (ex: any) {
      if (ex?.message === 'LICENSE_EXPIRED') {
        setError(ownerMode ? 'أثناء تعليق النظام، تسجيل الدخول متاح لمالك النظام فقط.' : 'ترخيص النظام غير مفعل حاليًا.')
      } else {
        setError(ex?.message || 'تعذر تسجيل الدخول')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={`login-card ${ownerMode ? 'owner-login-card' : ''}`} onSubmit={submit}>
      <div className="login-logo">H</div>
      <h1>{ownerMode ? 'دخول مالك النظام' : 'Hotel Performance System'}</h1>
      <p>{ownerMode ? 'تسجيل الدخول لإدارة الترخيص وإعادة تشغيل النظام.' : 'تسجيل الدخول إلى نظام إدارة أداء الفنادق'}</p>
      {error && <div className="alert error">{error}</div>}
      <label>
        اسم المستخدم
        <input autoFocus value={username} onChange={e => setUsername(e.target.value)} placeholder="Mostafa" autoComplete="username" />
      </label>
      <label>
        كلمة المرور
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
      </label>
      <button className="btn primary wide" disabled={loading}>{loading ? 'جاري الدخول...' : 'تسجيل الدخول'}</button>
      {ownerMode && onBack ? (
        <button type="button" className="suspension-back" onClick={onBack}>العودة إلى حالة النظام</button>
      ) : (
        <div className="login-note">صلاحيات المستخدم تحدد الصفحات والإجراءات المتاحة.</div>
      )}
    </form>
  )
}

function SuspendedScreen({
  license,
  onOwnerLogin,
}: {
  license: PublicLicenseInfo
  onOwnerLogin: () => void
}) {
  const price = Number(license.renewal_price || 20).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  const currency = (license.renewal_currency || 'USD').toUpperCase()

  return (
    <div className="suspension-page" dir="rtl">
      <div className="suspension-shell">
        <div className="suspension-topbar">
          <div className="suspension-brand">
            <span className="suspension-brand-icon"><Server size={22} /></span>
            <div>
              <strong>Hotel Performance System</strong>
              <small>System Subscription</small>
            </div>
          </div>
          <span className="suspension-status-pill"><span /> Suspended</span>
        </div>

        <section className="suspension-hero">
          <div className="suspension-alert-icon"><ShieldAlert size={36} /></div>
          <div>
            <div className="suspension-kicker">SYSTEM ACCESS STATUS</div>
            <h1>{license.suspension_title || fallbackSuspension.suspension_title}</h1>
            <p>{license.suspension_message || fallbackSuspension.suspension_message}</p>
          </div>
        </section>

        <div className="suspension-grid">
          <div className="suspension-card">
            <span className="suspension-card-icon danger"><LockKeyhole size={20} /></span>
            <small>System Status</small>
            <strong>Suspended</strong>
            <p>تم تعليق دخول المستخدمين مؤقتًا.</p>
          </div>
          <div className="suspension-card renewal-card">
            <span className="suspension-card-icon"><Server size={20} /></span>
            <small>Renewal</small>
            <div className="suspension-price"><b>{currency === 'USD' ? '$' : ''}{price}</b><span>{currency !== 'USD' ? currency : ''} / month</span></div>
            <p>قيمة تجديد اشتراك النظام المحددة من الإدارة.</p>
          </div>
          <div className="suspension-card">
            <span className="suspension-card-icon safe"><Database size={20} /></span>
            <small>Data Status</small>
            <strong>Safe</strong>
            <p>تعليق الدخول لا يحذف بيانات النظام.</p>
          </div>
        </div>

        <div className="suspension-notice">
          <div>
            <strong>يلزم التواصل مع مسؤول النظام</strong>
            <p>سيعود تسجيل الدخول تلقائيًا بعد إعادة تفعيل الترخيص.</p>
          </div>
          <button className="owner-access-btn" onClick={onOwnerLogin}>
            <UserRoundCog size={18} /> دخول مالك النظام
          </button>
        </div>

        <div className="suspension-footer">
          <span>Hotel Performance System</span>
          <span>Secure Access Gateway</span>
        </div>
      </div>
    </div>
  )
}

export default function Login({ onLogin }: { onLogin: (u: User, t: string) => void }) {
  const [license, setLicense] = useState<PublicLicenseInfo | null>(null)
  const [ownerMode, setOwnerMode] = useState(false)
  const [statusLoaded, setStatusLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadStatus = async () => {
      try {
        const info = await getPublicLicense()
        if (!cancelled) {
          setLicense(info)
          if (info.active) setOwnerMode(false)
        }
      } catch {
        if (!cancelled) setLicense(fallbackSuspension)
      } finally {
        if (!cancelled) setStatusLoaded(true)
      }
    }

    loadStatus()
    const timer = window.setInterval(loadStatus, 15_000)
    const onVisible = () => { if (document.visibilityState === 'visible') loadStatus() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!statusLoaded) {
    return (
      <div className="login-page">
        <div className="login-card login-status-loading">
          <div className="login-logo">H</div>
          <h1>Hotel Performance System</h1>
          <p>جاري التحقق من حالة النظام...</p>
        </div>
      </div>
    )
  }

  if (license && !license.active) {
    if (ownerMode) {
      return <div className="login-page owner-login-page"><LoginForm onLogin={onLogin} ownerMode onBack={() => setOwnerMode(false)} /></div>
    }
    return <SuspendedScreen license={license} onOwnerLogin={() => setOwnerMode(true)} />
  }

  return <div className="login-page"><LoginForm onLogin={onLogin} /></div>
}
