function safeNumber(value: any) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export default function StatCard({ title, value, unit }: { title: string; value: any; unit?: string }) {
  const numeric = safeNumber(value)
  return (
    <div className="stat-card">
      <div className="stat-title">{title}</div>
      <div className="stat-value">
        {numeric.toLocaleString('en-US', { maximumFractionDigits: 2 })}
        {unit ? ` ${unit}` : ''}
      </div>
    </div>
  )
}
