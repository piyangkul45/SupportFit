function getBarStyle(percent) {
  if (percent >= 80) return 'from-lime-500 to-lime-300 shadow-[0_0_10px_-1px_rgba(163,230,53,0.8)]'
  if (percent >= 50) return 'from-amber-500 to-amber-300 shadow-[0_0_10px_-1px_rgba(245,158,11,0.7)]'
  return 'from-red-500 to-red-400 shadow-[0_0_10px_-1px_rgba(239,68,68,0.7)]'
}

export default function MacroProgressBar({ label, current, target, unit }) {
  const safeTarget = target || 1
  const rawPercent = (current / safeTarget) * 100
  const displayPercent = Math.round(rawPercent)
  const barWidth = Math.min(rawPercent, 100)

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-300">{label}</span>
        <span className="text-slate-500">
          {Math.round(current)} / {target} {unit} ({displayPercent}%)
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${getBarStyle(displayPercent)}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  )
}
