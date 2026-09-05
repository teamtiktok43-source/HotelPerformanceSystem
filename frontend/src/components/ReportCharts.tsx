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
