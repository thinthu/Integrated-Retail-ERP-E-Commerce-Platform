import { useEffect, useMemo, useState } from 'react'
import { api, API } from './api'
import { Art, specMap, COLORS, colorsOf } from './Bike'
import { Icon } from './Icons'
import PayModal from './PayModal'
const m = (n) => Number(n || 0).toFixed(2)
const eff = (p) => (p.price * (100 - (p.salePercent || 0))) / 100

export function Price({ p, big }) {
  const sale = (p.salePercent || 0) > 0
  return (<span className={'pricebox' + (big ? ' big' : '')}><b className={'price' + (sale ? ' sale' : '')}>${m(eff(p))}</b>{sale && <><s className="old">${m(p.price)}</s><span className="saletag">-{p.salePercent}%</span></>}</span>)
}

export function Detail({ p, t, onClose, add }) {
  const cl = colorsOf(p), [col, setCol] = useState(cl[0] || 'blue'), [view, setView] = useState('all'), [n, setN] = useState(1), [kind, setKind] = useState('photo'), sp = specMap(p.specs)
  return (<div className="overlay" onClick={onClose}><div className="detail" onClick={(e) => e.stopPropagation()}>
    <div><div className="bigart"><Art p={p} color={col} view={view} onKind={setKind} /></div>
      {kind === 'svg' && p.category !== 'Accessories' && <div className="thumbs">{['all', 'drive', 'wheel', 'bar'].map((v) => <button key={v} className={'thumb' + (v === view ? ' on' : '')} onClick={() => setView(v)}><Art p={p} color={col} view={v} /><small>{t('view_' + v)}</small></button>)}</div>}</div>
    <div className="dinfo"><button className="x" onClick={onClose} aria-label="Close"><Icon n="close" /></button>
      <small className="muted">{t.c(p.category)} · {p.brand} · {p.sku}</small><h2>{p.name}</h2>
      <div className="prow"><Price p={p} big /><span className={p.stock <= p.reorderLevel ? 'warn' : 'ok'}>{p.stock > 0 ? t('stock', { n: p.stock }) : t('sold')}</span></div>
      <p>{t('b_' + p.category)}</p><p className="muted">{p.description}</p>
      <div className="row l"><b>{t('color')}</b>{cl.map((c) => <button key={c} className={'sw' + (c === col ? ' on' : '')} style={{ background: COLORS[c] || '#9ca3af' }} onClick={() => setCol(c)} title={c} />)}</div>
      <h4>{t('specs')}</h4><table className="specs"><tbody>{Object.entries(sp).map(([k, v]) => <tr key={k}><td>{t('sp_' + k)}</td><td><b>{v}</b></td></tr>)}</tbody></table>
      <div className="row l"><button className="mini" onClick={() => setN(Math.max(1, n - 1))}>−</button><b>{n}</b><button className="mini" onClick={() => setN(Math.min(p.stock, n + 1))}>+</button>
        <button className="btn grow1" disabled={p.stock === 0} onClick={() => { add(p, n); onClose() }}>{t('add')}</button></div>
      <button className="link" onClick={() => { window.dispatchEvent(new CustomEvent('ask', { detail: `Tell me more about ${p.name}` })); onClose() }}>{t('askAI')}</button>
    </div></div></div>)
}

export function CartDrawer({ open, onClose, ps, cart, setCart, user, needLogin, t, goOrders }) {
  const [pay, setPay] = useState('KBZPAY'), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [payFor, setPayFor] = useState(null)
  const lines = Object.entries(cart).filter(([id, q]) => q > 0 && ps.find((p) => p.id === +id)).map(([id, qty]) => ({ productId: +id, qty }))
  const total = lines.reduce((s, l) => s + l.qty * eff(ps.find((p) => p.id === l.productId)), 0)
  const chg = (p, d) => setCart((c) => ({ ...c, [p.id]: Math.max(0, Math.min((c[p.id] || 0) + d, p.stock)) }))
  const checkout = async () => {
    if (!user) { onClose(); return needLogin() }
    setErr(''); setMsg(''); setBusy(true)
    try { const o = await api('/api/orders', { method: 'POST', body: lines }); setCart({}); setPayFor({ order: o, method: pay }) } catch (e) { setErr(e.message) }
    setBusy(false)
  }
  const finished = (r) => { setMsg(r ? t('ordered', { n: payFor.order.id }) : `Order #${payFor.order.id} is saved and waiting for payment. You can pay from My orders.`); setPayFor(null) }
  if (!open && !payFor) return null
  return (<>{open && <><div className="scrim" onClick={onClose} /><aside className="drawer"><div className="dhead"><h3>{t('cart')}</h3><button className="icobtn" onClick={onClose}><Icon n="close" /></button></div>
    {msg && <div className="notice"><Icon n="check" s={16} />{msg}</div>}{err && <div className="alert"><Icon n="alert" s={16} />{err}</div>}
    <div className="ditems">{lines.length === 0 && !msg && <p className="muted">{t('empty')}</p>}
      {lines.map((l) => { const p = ps.find((x) => x.id === l.productId); return (<div className="ditem" key={l.productId}><div className="dimg"><Art p={p} /></div><div className="grow1"><b>{p.name}</b><div className="muted">${m(eff(p))}</div>
        <div className="row l"><button className="mini" onClick={() => chg(p, -1)}>−</button><b>{l.qty}</b><button className="mini" onClick={() => chg(p, 1)}>+</button></div></div><b>${m(eff(p) * l.qty)}</b></div>) })}</div>
    <div className="dfoot"><div className="prow"><b>{t('total')}</b><b>${m(total)}</b></div><label className="muted">{t('pay')}</label>
      <select value={pay} onChange={(e) => setPay(e.target.value)}><option value="KBZPAY">KBZPay</option><option value="WAVE">Wave Pay</option><option value="AYAPAY">AYA Pay</option><option value="CARD">Credit / debit card</option><option value="COD">Cash on delivery</option></select>
      <button className="btn full" disabled={!lines.length || busy} onClick={checkout}>{user ? t('checkout') : t('loginFirst')}</button>
      {msg ? <button className="btn ghost full" onClick={() => { onClose(); goOrders() }}>{t('viewOrders')}</button> : <button className="btn ghost full" onClick={onClose}>{t('continue')}</button>}</div></aside></>}
    {payFor && <PayModal order={payFor.order} method={payFor.method} onClose={finished} onPaid={() => {}} />}</>)
}

function CompareModal({ items, t, onClose }) {
  const keys = [...new Set(items.flatMap((p) => Object.keys(specMap(p.specs))))]
  return (<div className="overlay" onClick={onClose}><div className="modal cmp" onClick={(e) => e.stopPropagation()}><div className="row"><h3>{t('compare')}</h3><button className="icobtn" onClick={onClose}><Icon n="close" /></button></div>
    <div className="tablewrap"><table><thead><tr><th></th>{items.map((p) => <th key={p.id}><div className="cmpimg"><Art p={p} /></div>{p.name}</th>)}</tr></thead>
      <tbody><tr><td>{t('price')}</td>{items.map((p) => <td key={p.id}><Price p={p} /></td>)}</tr><tr><td>{t('brand')}</td>{items.map((p) => <td key={p.id}>{p.brand}</td>)}</tr>
        {keys.map((k) => <tr key={k}><td>{t('sp_' + k)}</td>{items.map((p) => <td key={p.id}>{specMap(p.specs)[k] || '-'}</td>)}</tr>)}</tbody></table></div></div></div>)
}

export default function Store({ ps, t, q, cat, setCat, add, setSel, wl, toggleWl, saleOnly }) {
  const [brands, setBrands] = useState([]), [fb, setFb] = useState([]), [fc, setFc] = useState([]), [min, setMin] = useState(''), [max, setMax] = useState('')
  const [stockOnly, setStockOnly] = useState(false), [wlOnly, setWlOnly] = useState(false), [sort, setSort] = useState('pop'), [per, setPer] = useState(12), [page, setPage] = useState(1)
  const [cmp, setCmp] = useState([]), [showCmp, setShowCmp] = useState(false)
  useEffect(() => { api('/api/master/BRAND').then(setBrands).catch(() => {}) }, [])
  const cats = [...new Set(ps.map((p) => p.category).filter(Boolean))], colors = [...new Set(ps.flatMap(colorsOf))]
  const list = useMemo(() => {
    let r = ps.filter((p) => (cat === 'All' || p.category === cat) && (!saleOnly || (p.salePercent || 0) > 0) && (!fb.length || fb.includes(p.brand)) && (!fc.length || colorsOf(p).some((c) => fc.includes(c))) && (min === '' || eff(p) >= +min) && (max === '' || eff(p) <= +max)
      && (!stockOnly || p.stock > 0) && (!wlOnly || wl.includes(p.id)) && (p.name + ' ' + p.brand + ' ' + p.category).toLowerCase().includes(q.toLowerCase()))
    if (sort === 'pl') r = [...r].sort((a, b) => eff(a) - eff(b)); if (sort === 'ph') r = [...r].sort((a, b) => eff(b) - eff(a)); if (sort === 'az') r = [...r].sort((a, b) => a.name.localeCompare(b.name)); return r
  }, [ps, cat, saleOnly, fb, fc, min, max, stockOnly, wlOnly, wl, q, sort])
  const pages = Math.max(1, Math.ceil(list.length / per)), cur = Math.min(page, pages), home = cat === 'All' && !q && !saleOnly
  const tog = (a, set, v) => { set(a.includes(v) ? a.filter((x) => x !== v) : [...a, v]); setPage(1) }
  const clear = () => { setFb([]); setFc([]); setMin(''); setMax(''); setStockOnly(false); setWlOnly(false); setCat('All'); setPage(1) }
  const sale = ps.filter((p) => (p.salePercent || 0) > 0), fresh = [...ps].sort((a, b) => b.id - a.id).slice(0, 4)
  const strip = (title, items) => items.length > 0 && <section className="strip"><h3>{title}</h3><div className="pgrid four">{items.map((p) => card(p))}</div></section>
  const card = (p) => (<div className="pcard" key={p.id} onClick={() => setSel(p)}>
    <div className="pimg"><Art p={p} />{(p.salePercent || 0) > 0 && <span className="ribbon">-{p.salePercent}%</span>}<button className={'wl' + (wl.includes(p.id) ? ' on' : '')} aria-label="Wishlist" onClick={(e) => { e.stopPropagation(); toggleWl(p.id) }}><Icon n="heart" s={16} /></button>
      <div className="peek">{Object.entries(specMap(p.specs)).slice(0, 4).map(([k, v]) => <div key={k}><span>{t('sp_' + k)}</span><b>{v}</b></div>)}<em>{t('details')} →</em></div></div>
    <div className="pinfo"><small className="muted">{t.c(p.category)} · {p.brand}</small><h4>{p.name}</h4>
      <div className="dots">{colorsOf(p).map((c) => <i key={c} style={{ background: COLORS[c] || '#9ca3af' }} title={c} />)}</div>
      <div className="prow"><Price p={p} />{p.stock === 0 ? <span className="muted">{t('sold')}</span> : <button className="btn sm" onClick={(e) => { e.stopPropagation(); add(p) }}>{t('add')}</button>}</div>
      <div className="prow"><label className="radio small" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={cmp.includes(p.id)} onChange={() => setCmp(cmp.includes(p.id) ? cmp.filter((x) => x !== p.id) : cmp.length < 3 ? [...cmp, p.id] : cmp)} />{t('compare')}</label>
        {p.stock > 0 && p.stock <= p.reorderLevel && <small className="warn">{t('left', { n: p.stock })}</small>}</div></div></div>)
  return (<div>
    {home && <div className="hero" style={{ backgroundImage: `linear-gradient(90deg,#000000d0,#00000030),url(/images/hero.jpg),url(${API}/uploads/hero.jpg)` }}><div><h1>{t('hero1')}</h1><p>{t('hero2')}</p>
      <div className="row l"><button className="btn light" onClick={() => setCat('Electric')}>{t('shopEbikes')}</button><button className="btn dark" onClick={() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' })}>{t('browseAll')}</button></div></div></div>}
    {home && <section className="strip"><h3>{t('shopByCat')}</h3><div className="tiles">{cats.map((c) => <button key={c} className="tile" onClick={() => setCat(c)}><Art p={{ id: 0, category: c, name: c, specs: c === 'Accessories' ? 'Type: Helmet' : '' }} /><span>{t.c(c)}</span></button>)}</div></section>}
    {home && strip(t('onSale'), sale.slice(0, 4))}{home && strip(t('newArrivals'), fresh)}
    <div className="crumb">{t('home')} / {saleOnly ? t('sale') : t('bikes')} / <b>{cat === 'All' ? t('all') : t.c(cat)}</b></div>
    <p className="intro">{saleOnly ? t('saleIntro') : cat === 'All' ? t('hero2') : t('b_' + cat)}</p>
    <div className="catalog" id="results">
      <aside className="filters"><div className="row"><h4>{t('filters')}</h4><button className="link" onClick={clear}>{t('clearAll')}</button></div>
        <div className="fg"><b>{t('shop')}</b>{['All', ...cats].map((c) => <label key={c} className="radio"><input type="radio" checked={cat === c} onChange={() => { setCat(c); setPage(1) }} />{c === 'All' ? t('all') : t.c(c)}</label>)}</div>
        <div className="fg"><b>{t('brand')}</b>{brands.map((b) => <label key={b.id} className="radio"><input type="checkbox" checked={fb.includes(b.name)} onChange={() => tog(fb, setFb, b.name)} />{b.name}</label>)}</div>
        <div className="fg"><b>{t('price')} ($)</b><div className="row l"><input className="num" placeholder="Min" value={min} onChange={(e) => { setMin(e.target.value); setPage(1) }} /><input className="num" placeholder="Max" value={max} onChange={(e) => { setMax(e.target.value); setPage(1) }} /></div></div>
        <div className="fg"><b>{t('colors')}</b><div className="row l wrap">{colors.map((c) => <button key={c} title={c} className={'sw' + (fc.includes(c) ? ' on' : '')} style={{ background: COLORS[c] || '#9ca3af' }} onClick={() => tog(fc, setFc, c)} />)}</div></div>
        <label className="radio"><input type="checkbox" checked={stockOnly} onChange={(e) => { setStockOnly(e.target.checked); setPage(1) }} />{t('inStockOnly')}</label>
        <label className="radio"><input type="checkbox" checked={wlOnly} onChange={(e) => { setWlOnly(e.target.checked); setPage(1) }} />{t('wish')} ({wl.length})</label></aside>
      <div><div className="resbar"><b>{t('results', { n: list.length })}</b><div className="row l"><label className="muted">{t('perPage')}</label><select value={per} onChange={(e) => { setPer(+e.target.value); setPage(1) }}><option>12</option><option>24</option><option>48</option></select>
        <label className="muted">{t('sortBy')}</label><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="pop">{t('pop')}</option><option value="pl">{t('pl')}</option><option value="ph">{t('ph')}</option><option value="az">{t('az')}</option></select></div></div>
        <div className="pgrid">{list.slice((cur - 1) * per, cur * per).map(card)}</div>
        {list.length === 0 && <p className="muted">No products match your filters.</p>}
        {pages > 1 && <div className="pager">{Array.from({ length: pages }, (_, i) => <button key={i} className={'pg' + (i + 1 === cur ? ' on' : '')} onClick={() => setPage(i + 1)}>{i + 1}</button>)}</div>}</div></div>
    {cmp.length > 0 && <div className="cmpbar"><span>{t('compare')}: {cmp.length}/3</span><button className="btn sm" disabled={cmp.length < 2} onClick={() => setShowCmp(true)}>{t('compare')}</button><button className="link" onClick={() => setCmp([])}>{t('clearAll')}</button></div>}
    {showCmp && <CompareModal items={ps.filter((p) => cmp.includes(p.id))} t={t} onClose={() => setShowCmp(false)} />}
  </div>)
}
