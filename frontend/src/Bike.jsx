import { useEffect, useState } from 'react'
import { API } from './api'
export const COLORS = { red: '#ef4444', blue: '#3b82f6', black: '#1f2937', green: '#22c55e', orange: '#f97316', white: '#e5e7eb', yellow: '#eab308', teal: '#14b8a6' }
export const specMap = (s = '') => Object.fromEntries(s.split('|').filter(Boolean).map((x) => x.split(': ')))
const VB = { all: '0 0 320 200', drive: '85 85 110 110', wheel: '185 35 135 160', bar: '165 15 115 95' }
const abs = (u) => (u ? (u.startsWith('http') ? u : API + u) : null)
const slug = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
export const colorsOf = (p) => (Array.isArray(p.colors) ? p.colors : (p.colors || '').split(',')).filter(Boolean)

function Bike({ type, col }) {
  const r = type === 'Kids' ? 30 : type === 'BMX' || type === 'Folding' ? 36 : 46
  const R = [70, 140], F = [250, 140], BB = [140, 140], S = [112, 78], H = [212, 76], tire = type === 'Mountain' || type === 'BMX' ? 8 : type === 'Road' ? 3 : 5
  const L = (a, b, w = 6) => <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={col} strokeWidth={w} strokeLinecap="round" />
  const Wheel = ({ c }) => (<g><circle cx={c[0]} cy={c[1]} r={r} fill="none" stroke="var(--ink)" strokeWidth={tire} />
    {[0, 45, 90, 135].map((a) => <line key={a} x1={c[0] - r} y1={c[1]} x2={c[0] + r} y2={c[1]} stroke="var(--muted)" strokeWidth="1" transform={`rotate(${a} ${c[0]} ${c[1]})`} />)}<circle cx={c[0]} cy={c[1]} r="4" fill={col} /></g>)
  const drop = type === 'Road' || type === 'Gravel'
  return (<g><Wheel c={R} /><Wheel c={F} />{L(R, BB)}{L(R, S)}{L(BB, S)}{L(S, H)}{L(BB, H, 7)}{L(H, F, type === 'Mountain' ? 8 : 5)}
    {type === 'Electric' && <rect x="152" y="102" width="48" height="12" rx="5" fill="var(--muted)" transform="rotate(-41.6 176 108)" />}
    <line x1="104" y1="70" x2="128" y2="70" stroke="var(--ink)" strokeWidth="6" strokeLinecap="round" /><line x1="112" y1="78" x2="116" y2="70" stroke={col} strokeWidth="5" /><line x1="212" y1="76" x2="214" y2="58" stroke={col} strokeWidth="5" strokeLinecap="round" />
    {drop ? <path d="M214 58 q24 -2 24 20" fill="none" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" /> : <line x1="200" y1="56" x2="232" y2="56" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />}
    {type === 'City' && <path d="M236 40 h34 l-6 22 h-22z" fill="none" stroke="var(--muted)" strokeWidth="3" />}
    <circle cx="140" cy="140" r="11" fill="none" stroke="var(--ink)" strokeWidth="3" /><line x1="140" y1="140" x2="152" y2="158" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" /></g>)
}

// Photo order: the product's own photo -> /images/* (frontend/public/images, from the Pixabay script) -> backend/uploads/catalog/* -> neutral drawing.
const BASE = { road: 'road-bike', mountain: 'mountain-bike', electric: 'electric-bike', city: 'city-bike', kids: 'kids-bike', bmx: 'bmx-bike', folding: 'folding-bike', gravel: 'gravel-bike',
  helmet: 'helmet', gloves: 'cycling-gloves', light: 'bike-light', bottle: 'water-bottle', lock: 'bike-lock', pump: 'bicycle-pump', bag: 'bike-bag', bell: 'bicycle-bell' }
let manifest = null // frontend/public/images/images-manifest.json lists only photos the script verified
const loadManifest = () => (manifest ||= fetch('/images/images-manifest.json').then((r) => (r.ok ? r.json() : null)).then((j) => new Set((Array.isArray(j?.items) ? j.items.map((i) => i.file) : []).map((x) => String(x).toLowerCase()))).catch(() => new Set()))
// Only verified photos of the SAME product type are used. If there is none, the neutral placeholder is shown (never an unrelated photo).
function localPhotos(key, id, files) {
  const base = BASE[key]; if (!base || !files) return []
  const known = [...files].filter((f) => f.startsWith(base + '-')).sort()
  const i = known.length ? id % known.length : 0
  return [...known.slice(i), ...known.slice(0, i)].map((f) => '/images/' + f)
}
export function Art({ p, color, view = 'all', onKind }) {
  const [stage, setStage] = useState(0), [files, setFiles] = useState(null)
  useEffect(() => { loadManifest().then(setFiles) }, [])
  const sp = specMap(p.specs), key = p.category === 'Accessories' ? slug(sp.Type) : slug(p.category), n = ((p.id || 0) % 6) + 1
  const urls = [abs(p.imageUrl), ...localPhotos(key, p.id || 0, files), key && `${API}/uploads/catalog/${key}-${n}.jpg`, key && `${API}/uploads/catalog/${key}.jpg`].filter(Boolean)
  useEffect(() => { setStage(0) }, [p.imageUrl, p.category, p.id, files])
  const photo = stage < urls.length
  useEffect(() => { onKind && onKind(photo ? 'photo' : 'svg') }, [photo])
  if (photo) return <div className="photo"><img src={urls[stage]} alt={p.name} loading="lazy" onError={() => setStage(stage + 1)} /></div>
  const cn = color || colorsOf(p)[0] || 'blue', col = COLORS[cn] || '#64748b'
  if (p.category === 'Accessories') return <div className="artbox acc"><span>{sp.Type || 'Accessory'}</span></div>
  return <div className="artbox"><svg viewBox={VB[view]} preserveAspectRatio={view === 'all' ? 'xMidYMid meet' : 'xMidYMid slice'} className="art-svg"><Bike type={p.category} col={col} /></svg></div>
}
