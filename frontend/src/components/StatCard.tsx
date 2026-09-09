import type { ReactNode } from 'react'

function safeNumber(value: any) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

type Trend = 'up' | 'down' | 'neutral'

type StatCardProps = {
  title: string
  value: any
  unit?: string
  change?: string
  trend?: Trend
  icon?: ReactNode
  accentColor?: string
  sparklineData?: number[]
}

export default function StatCard({
  title,
  value,
  unit,
  change = 'الفترة المحددة',
  trend = 'neutral',
  icon,
  accentColor = 'blue',
  sparklineData = [2, 3, 2, 4, 3, 5, 4, 5],
}: StatCardProps) {
  const numeric = safeNumber(value)
  const points = sparklineData.length ? sparklineData : [0]
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = Math.max(max - min, 1)

  return (
    <div className={`stat-card stat-card-premium accent-${accentColor}`}>
      <div className="stat-top">
        <div className="stat-title">{title}</div>
        <div className="stat-icon" aria-hidden="true">{icon}</div>
      </div>
      <div className="stat-value">
        {numeric.toLocaleString('en-US', { maximumFractionDigits: 2 })}
        {unit ? ` ${unit}` : ''}
      </div>
      <div className={`stat-change ${trend}`}>
        {trend === 'up' && '↑'}
        {trend === 'down' && '↓'}
        {trend === 'neutral' && '—'}
        <span>{change}</span>
      </div>
      <div className="stat-sparkline" aria-hidden="true">
        {points.map((point, index) => {
          const height = 22 + ((Number(point) - min) / range) * 62
          return <span key={index} style={{ height: `${height}%` }} />
        })}
      </div>
    </div>
  )
}
