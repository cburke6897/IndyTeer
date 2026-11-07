export interface Point { label: string; value: number }

const W = 640
const H = 240
const pad = { t: 16, r: 12, b: 28, l: 36 }

function niceMax(v: number) {
  if (v <= 5) return 5
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / mag
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag
}

function Grid({ max }: { max: number }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  const ih = H - pad.t - pad.b
  return (
    <>
      {ticks.map((t) => {
        const y = pad.t + ih * (1 - t)
        return (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="#E5E8ED" strokeWidth={1} />
            <text x={pad.l - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#687385">{Math.round(max * t)}</text>
          </g>
        )
      })}
    </>
  )
}

export function BarChart({ data, unit = '', color = '#142C5B', label }: { data: Point[]; unit?: string; color?: string; label: string }) {
  const max = niceMax(Math.max(...data.map((d) => d.value), 1))
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const bw = Math.min(44, (iw / data.length) * 0.58)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      <Grid max={max} />
      {data.map((d, i) => {
        const x = pad.l + (iw / data.length) * (i + 0.5)
        const h = (d.value / max) * ih
        return (
          <g key={d.label}>
            <rect x={x - bw / 2} y={pad.t + ih - h} width={bw} height={h} rx={2} fill={color}>
              <title>{`${d.label}: ${d.value}${unit}`}</title>
            </rect>
            <text x={x} y={H - 8} textAnchor="middle" fontSize={11} fill="#687385">{d.label}</text>
            {d.value > 0 && <text x={x} y={pad.t + ih - h - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill="#202938">{d.value}</text>}
          </g>
        )
      })}
    </svg>
  )
}

export function AreaChart({ data, color = '#244B85', label, unit = '' }: { data: Point[]; color?: string; label: string; unit?: string }) {
  const max = niceMax(Math.max(...data.map((d) => d.value), 1))
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const pts = data.map((d, i) => ({ x: pad.l + (data.length === 1 ? iw / 2 : (iw / (data.length - 1)) * i), y: pad.t + ih - (d.value / max) * ih, d }))
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1].x},${pad.t + ih} L${pts[0].x},${pad.t + ih} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      <Grid max={max} />
      <path d={area} fill={color} opacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p) => (
        <g key={p.d.label}>
          <circle cx={p.x} cy={p.y} r={4} fill="#fff" stroke={color} strokeWidth={2.5}><title>{`${p.d.label}: ${p.d.value}${unit}`}</title></circle>
          <text x={p.x} y={H - 8} textAnchor="middle" fontSize={11} fill="#687385">{p.d.label}</text>
        </g>
      ))}
    </svg>
  )
}

export function RingChart({ value, label, sub }: { value: number; label: string; sub?: string }) {
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 128 128" className="size-32 shrink-0 -rotate-90" role="img" aria-label={`${label}: ${value}%`}>
        <circle cx="64" cy="64" r={r} fill="none" stroke="#E5E8ED" strokeWidth={12} />
        <circle cx="64" cy="64" r={r} fill="none" stroke="#F5C542" strokeWidth={12} strokeLinecap="butt" strokeDasharray={`${(value / 100) * c} ${c}`} />
        <text x="64" y="64" transform="rotate(90 64 64)" textAnchor="middle" dominantBaseline="central" fontSize={26} fontWeight={800} fill="#142C5B">{value}%</text>
      </svg>
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        {sub && <p className="mt-1 text-[13px] text-muted">{sub}</p>}
      </div>
    </div>
  )
}

export function HBarList({ data, color = '#142C5B' }: { data: Point[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex justify-between text-[13px]"><span className="font-medium text-ink">{d.label}</span><span className="text-muted">{d.value}</span></div>
          <div className="h-2 rounded-sm bg-surface"><div className="h-2 rounded-sm" style={{ width: `${(d.value / max) * 100}%`, background: color }} /></div>
        </li>
      ))}
    </ul>
  )
}
