import { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { User } from '../api'
import NotificationsBell from './NotificationsBell'

const items: [string, string][] = [
  ['/', 'الرئيسية'],
  ['/smart-entry', 'الإدخال اليومي الذكي'],
  ['/bookings', 'الحجوزات اليومية'],
  ['/revenue', 'الإيرادات اليومية'],
  ['/platforms', 'المنصات'],
  ['/reviews', 'التقييمات'],
  ['/ratings', 'تقييمات الفنادق'],
  ['/monthly', 'التقرير الشهري'],
  ['/hotels', 'إدارة الفنادق'],
  ['/employees', 'إدارة الموظفين'],
  ['/data', 'البيانات'],
]

export default function Layout({
  user,
  onLogout,
  children,
}: {
  user: User
  onLogout: () => void
  children: ReactNode
}) {
  const visibleItems =
    user.id === 1
      ? [...items, ['/license', 'إدارة الترخيص'] as [string, string]]
      : items

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">H</div>
          <div>
            <strong>Hotel Performance</strong>
            <small>System</small>
          </div>
        </div>

        <nav>
          {visibleItems.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              {label}
            </NavLink>
          ))}
        </nav>

        <button className="logout" onClick={onLogout}>
          تسجيل الخروج
        </button>
      </aside>

      <main className="main">
        <header>
          <div className="header-branding">
            <h1>Hotel Performance System</h1>
            <span className="live-dot">● متصل</span>
          </div>

          <div className="creator-credit" aria-label="Created by Mostafa Amer">
            Created by Mostafa Amer
          </div>

          <div className="header-actions">
            <NotificationsBell />
            <div className="user-pill">
              <b>{user.display_name}</b>
              <span>{user.role}</span>
            </div>
          </div>
        </header>

        {children}

        <div className="print-footer" aria-hidden="true">
          Created by Mostafa Amer
        </div>
      </main>
    </div>
  )
}
