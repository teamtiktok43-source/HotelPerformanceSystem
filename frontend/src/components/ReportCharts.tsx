import { useMemo } from 'react'

export type ChartItem = { name: string; value: number }

const n = (v: any) => Number.isFinite(Number(v)) ? Number(v) : 0

const shortName = (name: string, max = 20) => name.length > max ? `${name.slice(0, max)}…` : name

export function HorizontalBars({
  data,
  title,
  valueSuffix = '',
  maxItems = 7,
  className = '',
}: {
  data: ChartItem[]
  title: string
  valueSuffix?: string
  maxItems?: number
  className?: string
}) {
  const items = useMemo(() => data.filter(x => n(x.value) > 0).slice(0, maxItems), [data, maxItems])
  const max = Math.max(...items.map(x => n(x.value)), 1)

  return (
    <div className={`visual-chart ${className}`}>
      <div className="visual-chart-title">{title}</div>
      <div className="bar-list">
        {items.length ? items.map((item) => {
          const value = n(item.value)
          const width = Math.max(4, (value / max) * 100)
          return (
            <div className="bar-row" key={item.name}>
              <div className="bar-label" title={item.name}>{shortName(item.name)}</div>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${width}%` }} /></div>
              <div className="bar-value">{value.toLocaleString('en-US')}{valueSuffix}</div>
            </div>
          )
        }) : <div className="chart-empty">لا توجد بيانات</div>}
      </div>
    </div>
  )
}

export function DonutChart({
  paid,
  cash,
  title,
}: {
  paid: number
  cash: number
  title: string
}) {
  const p = n(paid)
  const c = n(cash)
  const total = p + c
  const paidPct = total ? Math.round((p / total) * 100) : 0
  const cashPct = total ? 100 - paidPct : 0
  const gradient = total
    ? `conic-gradient(#176aa6 0 ${paidPct}%, #8db7cf ${paidPct}% 100%)`
    : 'conic-gradient(#dce5ec 0 100%)'

  return (
    <div className="visual-chart donut-card">
      <div className="visual-chart-title">{title}</div>
      <div className="donut-wrap">
        <div className="donut" style={{ background: gradient }}>
          <div className="donut-center">
            <strong>{paidPct}%</strong>
            <span>مدفوع</span>
          </div>
        </div>
      </div>
      <div className="donut-legend">
        <span><i className="legend-dot paid" /> مدفوع {p}</span>
        <span><i className="legend-dot cash" /> كاش {c}</span>
      </div>
    </div>
  )
}

export function ProgressList({
  items,
  title,
  max = 100,
  formatter = (v: number) => `${v}`,
}: {
  items: ChartItem[]
  title: string
  max?: number
  formatter?: (v: number) => string
}) {
  return (
    <div className="visual-chart progress-card">
      <div className="visual-chart-title">{title}</div>
      <div className="progress-list">
        {items.map(item => {
          const value = Math.max(0, n(item.value))
          const width = Math.min(100, max ? (value / max) * 100 : 0)
          return (
            <div className="progress-row" key={item.name}>
              <div className="progress-head"><span>{item.name}</span><strong>{formatter(value)}</strong></div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${width}%` }} /></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


export function ComparisonDonut({
  current,
  previous,
  title,
  currentLabel = 'الحالي',
  previousLabel = 'السابق',
  formatValue = (v: number) => v.toLocaleString('en-US'),
}: {
  current: number
  previous: number
  title: string
  currentLabel?: string
  previousLabel?: string
  formatValue?: (v: number) => string
}) {
  const a = n(current)
  const b = n(previous)
  const total = a + b
  const currentPct = total ? Math.round((a / total) * 100) : 0
  const gradient = total
    ? `conic-gradient(#176aa6 0 ${currentPct}%, #8db7cf ${currentPct}% 100%)`
    : 'conic-gradient(#dce5ec 0 100%)'

  return (
    <div className="visual-chart donut-card compact-donut">
      <div className="visual-chart-title">{title}</div>
      <div className="donut-wrap">
        <div className="donut" style={{ background: gradient }}>
          <div className="donut-center">
            <strong>{currentPct}%</strong>
            <span>{currentLabel}</span>
          </div>
        </div>
      </div>
      <div className="donut-legend comparison-legend">
        <span><i className="legend-dot paid" /> {currentLabel} {formatValue(a)}</span>
        <span><i className="legend-dot cash" /> {previousLabel} {formatValue(b)}</span>
      </div>
    </div>
  )
}




function PlatformBrandIcon({ name }: { name: string }) {
  const value = String(name || '').toLowerCase()
  const cls = value.includes('booking') ? 'booking' : value.includes('expedia') ? 'expedia' : value.includes('trip') ? 'trip' : value.includes('agoda') ? 'agoda' : 'other'
  const label = cls === 'booking' ? 'B' : cls === 'expedia' ? '↗' : cls === 'trip' ? 'T' : cls === 'agoda' ? 'A' : '•'
  return <span className={`platform-brand-icon ${cls}`} aria-hidden="true">{label}</span>
}

export function PlatformShareChart({ title, items }: { title: string; items: { platform: string; value: number; percentage: number }[] }) {
  const palette = ['#146db2', '#22a879', '#f59e0b', '#8b5cf6', '#ef476f', '#607d8b', '#0ea5e9', '#94a3b8']
  const rows = Array.isArray(items) ? items.filter(x => n(x.value) > 0) : []
  const total = rows.reduce((sum, x) => sum + n(x.value), 0)
  return <div className="platform-chart-card">
    <div className="visual-chart-title">{title}</div>
    <div className="platform-stack">{rows.length ? rows.map((x, i) => <span key={`${x.platform}-${i}`} title={`${x.platform}: ${x.percentage}%`} style={{ width: `${Math.max(1, n(x.percentage))}%`, background: palette[i % palette.length] }} />) : <span style={{ width: '100%', background: '#dce5ec' }} />}</div>
    <div className="platform-legend">{rows.length ? rows.map((x, i) => <div className="platform-legend-item" key={`${x.platform}-legend-${i}`}><PlatformBrandIcon name={x.platform} /><span className="platform-legend-name">{x.platform}</span><strong>{total ? `${n(x.percentage).toFixed(1)}%` : '0%'}</strong></div>) : <div className="chart-empty">لا توجد بيانات</div>}</div>
  </div>
}
