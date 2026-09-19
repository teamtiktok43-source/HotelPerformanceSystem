import { FormEvent, useEffect, useState } from 'react'
import { Activity, Database, LockKeyhole, Server, ShieldAlert } from 'lucide-react'
import { apiFetch, getPublicLicense, PublicLicenseInfo, User } from '../api'

const fallbackSuspension: PublicLicenseInfo = {
  active: true,
  renewal_price: 20,
  renewal_currency: 'USD',
  suspension_title: 'Service Access Suspended',
  suspension_message: 'Subscription renewal is required to restore access.',
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
        setError(ownerMode ? 'هذا المسار متاح للحساب المخول فقط.' : 'ترخيص النظام غير مفعل حاليًا.')
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
      <h1>{ownerMode ? 'Authorized Maintenance Access' : 'Hotel Performance System'}</h1>
      <p>{ownerMode ? 'Restricted access for authorized recovery only.' : 'تسجيل الدخول إلى نظام إدارة أداء الفنادق'}</p>
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

function SuspendedScreen({ license }: { license: PublicLicenseInfo }) {
  const price = Number(license.renewal_price || 20).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  const currency = (license.renewal_currency || 'USD').toUpperCase()
  const legacyTitle = 'Service Temporarily Suspended'
  const legacyMessage = 'The Hotel Performance System subscription is currently inactive. Please contact the system administrator to restore access.'
  const title = !license.suspension_title || license.suspension_title === legacyTitle
    ? fallbackSuspension.suspension_title
    : license.suspension_title
  const message = !license.suspension_message || license.suspension_message === legacyMessage
    ? fallbackSuspension.suspension_message
    : license.suspension_message

  return (
    <div className="suspension-page" dir="ltr">
      <div className="suspension-shell">
        <div className="suspension-topbar">
          <div className="gateway-label">
            <span className="gateway-leds" aria-hidden="true"><i /><i /><i /></span>
            <span>SECURE ACCESS GATEWAY</span>
          </div>
          <span className="suspension-status-pill"><span /> Suspended</span>
        </div>

        <section className="suspension-hero">
          <div className="server-visual" aria-hidden="true">
            <div className="server-visual-head"><Server size={26} /><span>ACCESS NODE</span></div>
            <div className="server-rack"><span className="rack-light danger" /><b /><b /><Activity size={16} /></div>
            <div className="server-rack"><span className="rack-light" /><b /><b /><Server size={16} /></div>
            <div className="server-rack"><span className="rack-light safe" /><b /><b /><Database size={16} /></div>
          </div>
          <div className="suspension-copy">
            <div className="suspension-kicker">SERVICE STATUS</div>
            <div className="suspension-title-row">
              <span className="suspension-alert-icon"><ShieldAlert size={32} /></span>
              <h1>{title}</h1>
            </div>
            <p>{message}</p>
          </div>
        </section>

        <div className="suspension-grid">
          <div className="suspension-card">
            <span className="suspension-card-icon danger"><LockKeyhole size={20} /></span>
            <small>System Status</small>
            <strong>Suspended</strong>
            <span className="metric-line"><i className="metric-dot danger" /> ACCESS RESTRICTED</span>
          </div>
          <div className="suspension-card renewal-card">
            <span className="suspension-card-icon"><Server size={20} /></span>
            <small>Renewal</small>
            <div className="suspension-price"><b>{currency === 'USD' ? '$' : ''}{price}</b><span>{currency !== 'USD' ? currency : ''} / month</span></div>
            <span className="metric-line"><i className="metric-dot" /> RENEWAL REQUIRED</span>
          </div>
          <div className="suspension-card">
            <span className="suspension-card-icon safe"><Database size={20} /></span>
            <small>Data Status</small>
            <strong>Safe</strong>
            <span className="metric-line"><i className="metric-dot safe" /> DATA PRESERVED</span>
          </div>
        </div>

        <div className="suspension-renewal-strip">
          <div>
            <span>SERVICE RENEWAL REQUIRED</span>
            <strong>Access will be restored automatically after subscription renewal.</strong>
          </div>
          <div className="renewal-signal" aria-hidden="true"><i /><i /><i /><i /></div>
        </div>

        <div className="suspension-footer">
          <span>SECURE ACCESS GATEWAY</span>
          <span className="footer-status"><i /> STATUS: SUSPENDED</span>
        </div>
      </div>
    </div>
  )
}

export default function Login({ onLogin }: { onLogin: (u: User, t: string) => void }) {
  const [license, setLicense] = useState<PublicLicenseInfo | null>(null)
  const ownerMode = new URLSearchParams(window.location.search).get('owner') === '1'
  const [statusLoaded, setStatusLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadStatus = async () => {
      try {
        const info = await getPublicLicense()
        if (!cancelled) {
          setLicense(info)
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
          <h1>Checking service status...</h1>
          <p>جاري التحقق من حالة الخدمة...</p>
        </div>
      </div>
    )
  }

  if (license && !license.active) {
    if (ownerMode) {
      return <div className="login-page owner-login-page"><LoginForm onLogin={onLogin} ownerMode /></div>
    }
    return <SuspendedScreen license={license} />
  }

  return <div className="login-page"><LoginForm onLogin={onLogin} /></div>
}
