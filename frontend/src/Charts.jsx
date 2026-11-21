export const PAL = ['#0a6cb3', '#2a9d8f', '#e9a23b', '#7a8794', '#c0504d', '#6a5acd', '#3d8bd9', '#8fb339', '#b5651d']
export function Area({ data, color = '#22d3ee', h = 210 }) {
  const W = 600, pad = 28, mx = Math.max(1, ...data.map((d) => d.v)) * 1.15
  const pts = data.map((d, i) => [pad + (i * (W - 2 * pad)) / Math.max(1, data.length - 1), h - 24 - (d.v / mx) * (h - 50)])
  const path = pts.map((p, i) => (i ? `C${(pts[i - 1][0] + p[0]) / 2},${pts[i - 1][1]} ${(pts[i - 1][0] + p[0]) / 2},${p[1]} ${p[0]},${p[1]}` : `M${p[0]},${p[1]}`)).join(' ')
  const area = `${path} L${pts[pts.length - 1][0]},${h - 24} L${pts[0][0]},${h - 24}Z`
  return (<svg viewBox={`0 0 ${W} ${h}`} className="chart">
    <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".55" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
    {[0, 1, 2, 3].map((i) => <line key={i} x1={pad} x2={W - pad} y1={26 + (i * (h - 50)) / 3} y2={26 + (i * (h - 50)) / 3} stroke="var(--line)" strokeDasharray="4 4" />)}
    <path d={area} fill="url(#ag)" /><path d={path} fill="none" stroke={color} strokeWidth="3" pathLength="1" className="draw" />
    {pts.map((p, i) => <g key={i}><circle cx={p[0]} cy={p[1]} r="4.5" fill="var(--panel)" stroke={color} strokeWidth="2.5" /><text x={p[0]} y={h - 6} textAnchor="middle" className="lbl">{data[i].l}</text></g>)}
  </svg>)
}
export function Bars({ data, h = 210 }) {
  const W = data.length * 70, mx = Math.max(1, ...data.map((d) => d.v))
  return (<svg viewBox={`0 0 ${W} ${h}`} className="chart">
    <defs>{data.map((d, i) => <linearGradient key={i} id={'bg' + i} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={PAL[i % PAL.length]} /><stop offset="1" stopColor={PAL[(i + 2) % PAL.length]} /></linearGradient>)}</defs>
    {data.map((d, i) => { const bh = Math.max(4, (d.v / mx) * (h - 60)); return (<g key={i}>
      <rect x={i * 70 + 16} y={h - 30 - bh} width="38" height={bh} rx="19" fill={`url(#bg${i})`} className="grow" style={{ animationDelay: i * 90 + 'ms' }} />
      <text x={i * 70 + 35} y={h - 36 - bh} textAnchor="middle" className="lbl">{d.v}</text><text x={i * 70 + 35} y={h - 10} textAnchor="middle" className="lbl">{d.l}</text></g>) })}
  </svg>)
}
export function Donut({ data }) {
  const tot = data.reduce((s, d) => s + d.v, 0) || 1, r = 62, C = 2 * Math.PI * r; let off = 0
  return (<svg viewBox="0 0 180 180" className="donut"><g transform="rotate(-90 90 90)">
    {data.map((d, i) => { const len = (d.v / tot) * C; const el = <circle key={i} cx="90" cy="90" r={r} fill="none" stroke={PAL[i % PAL.length]} strokeWidth="22" strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-off} />; off += len; return el })}</g>
    <text x="90" y="88" textAnchor="middle" className="donut1">${Math.round(tot).toLocaleString()}</text></svg>)
}
export function Spark({ data, color }) {
  const mx = Math.max(1, ...data), mn = Math.min(...data)
  const pts = data.map((v, i) => `${i * (80 / Math.max(1, data.length - 1))},${30 - ((v - mn) / (mx - mn || 1)) * 26}`).join(' ')
  return <svg viewBox="0 0 80 32" className="spark"><polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" /></svg>
}

export function Group({ data, keys, colors, h = 230 }) {
  const W = Math.max(1, data.length) * 110, mx = Math.max(1, ...data.flatMap((d) => keys.map((k) => d[k])))
  return (<svg viewBox={`0 0 ${W} ${h}`} className="chart">
    {[0, 1, 2, 3].map((i) => <line key={i} x1="0" x2={W} y1={20 + (i * (h - 60)) / 3} y2={20 + (i * (h - 60)) / 3} stroke="var(--line)" strokeDasharray="4 4" />)}
    {data.map((d, i) => (<g key={i}>{keys.map((k, j) => { const bh = Math.max(2, (d[k] / mx) * (h - 60)); return <rect key={k} x={i * 110 + 14 + j * 28} y={h - 30 - bh} width="24" height={bh} rx="3" fill={colors[j]} className="grow" style={{ animationDelay: j * 80 + 'ms' }}><title>{k}: ${Math.round(d[k]).toLocaleString()}</title></rect> })}
      <text x={i * 110 + 55} y={h - 10} textAnchor="middle" className="lbl">{d.l}</text></g>))}
  </svg>)
}
