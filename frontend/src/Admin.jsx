import { useEffect, useState } from 'react'
import { api, download, useLive } from './api'
import { Area, Bars, Donut, Spark, PAL } from './Charts'
import { Art, specMap, COLORS, colorsOf } from './Bike'
import { Price } from './Store'
import { Icon } from './Icons'
import { Confirm } from './Dialog'
export const m = (n) => Number(n || 0).toFixed(2)
export const money = (n) => '$' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const fmt = (d) => (d ? new Date(d).toLocaleString() : '—')
export const mkT = (t) => (k, d) => { const v = t(k); return v === k ? d : v }
export const Err = ({ e }) => (e ? <div className="alert"><Icon n="alert" s={16} />{e}</div> : null)
const STATUSES = ['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']

function useCount(v) {
  const [n, setN] = useState(0)
  useEffect(() => { let s = null, f; const from = n; const step = (ts) => { s ??= ts; const k = Math.min(1, (ts - s) / 800); setN(from + (v - from) * k); if (k < 1) f = requestAnimationFrame(step) }; f = requestAnimationFrame(step); return () => cancelAnimationFrame(f) }, [v])
  return n
}
export function KPI({ label, value, prefix = '', suffix = '', color, icon, spark, dec = 0 }) {
  const c = useCount(value)
  return (<div className="kpi" style={{ '--k': color }}><div className="kico"><Icon n={icon} s={20} /></div><div className="kt"><small>{label}</small><b>{prefix}{c.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec })}{suffix}</b></div>{spark && <Spark data={spark} color={color} />}</div>)
}

export function Dashboard({ t }) {
  const T = mkT(t), [d, setD] = useState(null), [os, setOs] = useState([]), [low, setLow] = useState([]), [err, setErr] = useState('')
  const load = () => { api('/api/reports/overview').then(setD).catch((e) => setErr(e.message)); api('/api/orders').then((x) => setOs(x.slice(0, 6))).catch(() => {}); api('/api/products/low-stock').then((x) => setLow(x.slice(0, 8))).catch(() => {}) }
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i) }, []); useLive(load)
  if (!d) return <div className="page"><Err e={err} />Loading…</div>
  const daily = d.daily.map((x) => ({ l: x.day.slice(5), v: Math.round(x.revenue) })), sp = daily.map((x) => x.v)
  const st = STATUSES.map((s) => ({ l: t('st_' + s).slice(0, 7), v: d.status[s] || 0 })), cats = Object.entries(d.categories).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v })), mx = Math.max(1, ...d.top.map((x) => x.qty))
  return (<div className="page"><div className="row"><div><h2>{t('dash')}</h2><small className="muted">{T('x_dashsub', 'Best sellers, revenue and stock at a glance')}</small></div><span className="live"><i />{t('live')}</span></div>
    <div className="kpis"><KPI label={t('ordersN')} value={d.orders} color={PAL[0]} icon="receipt" spark={sp} /><KPI label={t('revenue')} value={d.revenue} prefix="$" color={PAL[1]} icon="chart" spark={sp} />
      <KPI label={t('customers')} value={d.customers} color={PAL[2]} icon="users" spark={[...sp].reverse()} /><KPI label={t('avg')} value={d.avgOrder} prefix="$" dec={2} color={PAL[5]} icon="tag" spark={sp} /></div>
    <div className="grid2"><div className="panel"><h3>{t('sales')}</h3><Area data={daily} color={PAL[0]} /></div><div className="panel"><h3>{t('status')}</h3><Bars data={st} /></div></div>
    <div className="grid3"><div className="panel"><h3>{t('cats')}</h3><div className="donutrow"><Donut data={cats} /><div className="legend">{cats.map((c, i) => <div key={c.k}><i style={{ background: PAL[i % PAL.length] }} />{t.c(c.k)}</div>)}</div></div></div>
      <div className="panel"><h3>{t('top')}</h3>{d.top.map((x, i) => <div className="toprow" key={x.name}><span className="rank">{i + 1}</span><div className="grow1"><div>{x.name}</div><div className="bar"><i style={{ width: (x.qty / mx) * 100 + '%' }} /></div></div><b>{x.qty}</b></div>)}</div>
      <div className="panel"><h3>{t('recent')}</h3>{os.map((o) => <div className="toprow" key={o.id}><span className="grow1">#{o.id} · {o.customer}</span><span className={'tag ' + o.status}>{t('st_' + o.status)}</span><b>${m(o.total)}</b></div>)}</div></div>
    <div className="panel"><h3>{t('lowList')} ({d.lowStock})</h3><div className="lowgrid">{low.map((p) => <div key={p.id} className="lowitem"><span>{p.name}</span><b className="warn">{p.stock}</b></div>)}</div></div></div>)
}

const SPEC = ['Frame', 'Gears', 'Brakes', 'Weight', 'Wheel', 'Warranty']
const blank = { sku: '', name: '', brand: '', category: '', supplierId: '', price: '', stock: '', reorderLevel: 5, salePercent: 0, colors: [], description: '', spec: {}, cost: '', imageUrl: null }
export function Inventory({ t, role }) {
  const T = mkT(t), ro = role === 'STAFF'
  const [ps, setPs] = useState([]), [f, setF] = useState(null), [err, setErr] = useState(''), [ok, setOk] = useState(''), [q, setQ] = useState(''), [pg, setPg] = useState(0), [busy, setBusy] = useState(false), [ask, setAsk] = useState(null)
  const [brands, setBrands] = useState([]), [cats, setCats] = useState([]), [cols, setCols] = useState([]), [sups, setSups] = useState([])
  const load = () => api('/api/products').then(setPs).catch((e) => setErr(e.message))
  useEffect(() => { load(); if (!ro) { api('/api/master/BRAND').then(setBrands); api('/api/master/CATEGORY').then(setCats); api('/api/master/COLOR').then(setCols); api('/api/suppliers').then(setSups).catch(() => {}) } }, [])
  const edit = (p) => { setErr(''); setOk(''); setF({ ...p, supplierId: p.supplierId || '', colors: colorsOf(p), spec: specMap(p.specs), cost: '' }) }
  const save = async (e) => {
    e.preventDefault(); setErr(''); setOk(''); setBusy(true)
    try {
      const { spec, id, ...rest } = f
      const body = { ...rest, colors: f.colors.join(','), specs: SPEC.filter((k) => spec[k]).map((k) => k + ': ' + spec[k]).join('|'), price: +f.price, stock: +f.stock, reorderLevel: +f.reorderLevel, salePercent: +f.salePercent || 0, supplierId: f.supplierId ? +f.supplierId : null, cost: f.cost === '' || f.cost == null ? null : +f.cost }
      const saved = await api(id ? `/api/products/${id}` : '/api/products', { method: id ? 'PUT' : 'POST', body })
      if (!id) { setF({ ...f, id: saved.id }); setOk('Product saved. You can now upload its photo below.') } else { setF(null); setOk('Product updated.') }
      load()
    } catch (x) { setErr(x.message) }
    setBusy(false)
  }
  const upload = async (file) => { if (!file) return; const fd = new FormData(); fd.append('file', file); try { const r = await api(`/api/products/${f.id}/image`, { method: 'POST', body: fd }); setF({ ...f, imageUrl: r.imageUrl }); setOk('Photo uploaded.'); load() } catch (x) { setErr(x.message) } }
  const del = async () => { try { await api(`/api/products/${ask.id}`, { method: 'DELETE' }); setAsk(null); load() } catch (x) { setErr(x.message); setAsk(null) } }
  const rows = ps.filter((p) => (p.name + p.sku + p.category + p.brand).toLowerCase().includes(q.toLowerCase())), pages = Math.ceil(rows.length / 12), set = (k, v) => setF({ ...f, [k]: v })
  return (<div className="page"><div className="row"><h2>{t('x_inv') === 'x_inv' ? 'Products' : t('x_inv')} ({ps.length})</h2>{!ro && <button className="btn" onClick={() => { setErr(''); setOk(''); setF({ ...blank }) }}><Icon n="plus" s={16} /> {T('x_add', 'Add')}</button>}</div>
    {ro && <div className="notice"><Icon n="lock" s={16} />Staff accounts can view products and stock. Ask a Manager to change product details.</div>}
    {!f && <Err e={err} />}{ok && <div className="notice"><Icon n="check" s={16} />{ok}</div>}
    {f && <form className="panel pform" onSubmit={save}><h3>{f.id ? 'Edit product' : 'New product'}</h3><Err e={err} />
      <div className="fgrid">
        <label>SKU<input value={f.sku} onChange={(e) => set('sku', e.target.value)} required /></label><label>{T('x_name', 'Name')}<input value={f.name} onChange={(e) => set('name', e.target.value)} required /></label>
        <label>{t('brand')}<select value={f.brand || ''} onChange={(e) => set('brand', e.target.value)} required><option value="">Select…</option>{brands.map((b) => <option key={b.id}>{b.name}</option>)}</select></label>
        <label>{T('x_category', 'Category')}<select value={f.category || ''} onChange={(e) => set('category', e.target.value)} required><option value="">Select…</option>{cats.map((c) => <option key={c.id}>{c.name}</option>)}</select></label>
        <label>{T('x_supplier', 'Supplier')}<select value={f.supplierId || ''} onChange={(e) => set('supplierId', e.target.value)}><option value="">None</option>{sups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>{t('price')} ($)<input type="number" step="0.01" min="0" value={f.price} onChange={(e) => set('price', e.target.value)} required /></label><label>{T('x_stock', 'Stock')}<input type="number" min="0" value={f.stock} onChange={(e) => set('stock', e.target.value)} required /></label>
        <label>Low-stock alert at<input type="number" min="0" value={f.reorderLevel} onChange={(e) => set('reorderLevel', e.target.value)} /></label>
        {role === 'OWNER' && <label>{T('x_cost', 'Cost price')} ($) <small className="muted">confidential{f.id ? ' · blank = keep' : ''}</small><input type="number" step="0.01" min="0" value={f.cost} onChange={(e) => set('cost', e.target.value)} /></label>}</div>
      <div className="fg2"><b>{t('colors')}</b><div className="row l wrap">{cols.map((c) => <button type="button" key={c.id} className={'chip' + (f.colors.includes(c.name) ? ' on' : '')} onClick={() => set('colors', f.colors.includes(c.name) ? f.colors.filter((x) => x !== c.name) : [...f.colors, c.name])}><i className="cdot" style={{ background: c.extra || COLORS[c.name] }} />{c.name}</button>)}</div></div>
      <div className="fgrid">{SPEC.map((k) => <label key={k}>{t('sp_' + k)}<input value={f.spec[k] || ''} onChange={(e) => set('spec', { ...f.spec, [k]: e.target.value })} /></label>)}</div>
      <label className="block">Description<textarea rows="3" value={f.description || ''} onChange={(e) => set('description', e.target.value)} /></label>
      {f.id ? <div className="row l"><div className="thumb64"><Art p={{ ...f, colors: f.colors.join(',') }} /></div><label>Photo (JPG/PNG/WebP, max 10 MB)<input type="file" accept="image/*" onChange={(e) => upload(e.target.files[0])} /></label></div> : <small className="muted">Save the product first, then you can upload its photo.</small>}
      <div className="row l"><button className="btn" disabled={busy}>{T('x_save', 'Save')}</button><button type="button" className="btn ghost" onClick={() => setF(null)}>{T('x_close', 'Close')}</button></div></form>}
    <input className="search" placeholder={t('search')} value={q} onChange={(e) => { setQ(e.target.value); setPg(0) }} />
    <div className="panel tablewrap"><table><thead><tr><th></th><th>SKU</th><th>{T('x_name', 'Name')}</th><th>{t('brand')}</th><th>{T('x_category', 'Category')}</th><th>{t('price')}</th><th>{T('x_stock', 'Stock')}</th>{!ro && <th></th>}</tr></thead>
      <tbody>{rows.slice(pg * 12, pg * 12 + 12).map((p) => (<tr key={p.id}><td><div className="thumb40"><Art p={p} /></div></td><td>{p.sku}</td><td>{p.name}</td><td>{p.brand}</td><td>{t.c(p.category)}</td><td><Price p={p} /></td>
        <td><span className={p.stock <= p.reorderLevel ? 'tag CANCELLED' : 'tag PAID'}>{p.stock}</span></td>{!ro && <td className="actions"><button className="mini" onClick={() => edit(p)}><Icon n="edit" s={14} /> {T('x_edit', 'Edit')}</button> <button className="mini" onClick={() => setAsk(p)}><Icon n="trash" s={14} /></button></td>}</tr>))}</tbody></table></div>
    <div className="pager"><button className="pg" disabled={pg === 0} onClick={() => setPg(pg - 1)}>‹</button><span>{pg + 1} / {Math.max(1, pages)}</span><button className="pg" disabled={pg + 1 >= pages} onClick={() => setPg(pg + 1)}>›</button></div>
    {ask && <Confirm title="Delete product" danger yes={T('x_delete', 'Delete')} no={T('x_cancel', 'Cancel')} onYes={del} onNo={() => setAsk(null)}><p>Delete <b>{ask.name}</b> ({ask.sku})? This cannot be undone.</p></Confirm>}</div>)
}

function MasterCard({ type, title, color, t }) {
  const T = mkT(t), [items, setItems] = useState([]), [n, setN] = useState(''), [x, setX] = useState('#3b82f6'), [ed, setEd] = useState(null), [err, setErr] = useState(''), [ask, setAsk] = useState(null)
  const load = () => api('/api/master/' + type).then(setItems).catch((e) => setErr(e.message)); useEffect(() => { load() }, [])
  const add = async (e) => { e.preventDefault(); setErr(''); try { await api('/api/master/' + type, { method: 'POST', body: { name: n, extra: color ? x : null } }); setN(''); load() } catch (z) { setErr(z.message) } }
  const save = async (i) => { setErr(''); try { await api(`/api/master/${type}/${i.id}`, { method: 'PUT', body: { name: ed.name, extra: color ? ed.extra : i.extra } }); setEd(null); load() } catch (z) { setErr(z.message) } }
  const del = async () => { setErr(''); try { await api(`/api/master/${type}/${ask.id}`, { method: 'DELETE' }); setAsk(null); load() } catch (z) { setErr(z.message); setAsk(null) } }
  return (<div className="panel"><h3>{title} ({items.length})</h3><Err e={err} />
    <form className="row l" onSubmit={add}><input placeholder={`New ${title.toLowerCase().slice(0, -1)}`} value={n} onChange={(e) => setN(e.target.value)} required />{color && <input type="color" value={x} onChange={(e) => setX(e.target.value)} className="cpick" />}<button className="btn sm">{T('x_add', 'Add')}</button></form>
    <div className="mlist">{items.map((i) => (<div className="mrow" key={i.id}>{ed?.id === i.id ? (<><input value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} />{color && <input type="color" className="cpick" value={ed.extra || '#000000'} onChange={(e) => setEd({ ...ed, extra: e.target.value })} />}
      <button className="mini" onClick={() => save(i)}><Icon n="check" s={14} /></button><button className="mini" onClick={() => setEd(null)}><Icon n="close" s={14} /></button></>) : (<>
      {color && <i className="cdot big" style={{ background: i.extra }} />}<span className="grow1">{i.name}</span><button className="mini" onClick={() => setEd({ id: i.id, name: i.name, extra: i.extra })}><Icon n="edit" s={14} /></button><button className="mini" onClick={() => setAsk(i)}><Icon n="trash" s={14} /></button></>)}</div>))}</div>
    {ask && <Confirm title="Delete item" danger yes={T('x_delete', 'Delete')} no={T('x_cancel', 'Cancel')} onYes={del} onNo={() => setAsk(null)}><p>Delete <b>{ask.name}</b>? It can only be deleted if no product uses it.</p></Confirm>}</div>)
}
export function Catalog({ t }) { return (<div className="page"><h2>{t('x_catalog') === 'x_catalog' ? 'Catalog data' : t('x_catalog')}</h2><p className="muted">These lists feed the dropdowns in the product form and the shop filters. Renaming an item updates every product that uses it.</p><div className="grid3"><MasterCard t={t} type="BRAND" title="Brands" /><MasterCard t={t} type="CATEGORY" title="Categories" /><MasterCard t={t} type="COLOR" title="Colors" color /></div></div>) }

export function Orders({ t }) {
  const T = mkT(t), [os, setOs] = useState([]), [flt, setFlt] = useState('ALL'), [err, setErr] = useState(''), [hist, setHist] = useState(null), [chg, setChg] = useState(null), [busy, setBusy] = useState(false)
  const load = () => api('/api/orders').then(setOs).catch((e) => setErr(e.message)); useEffect(() => { load() }, []); useLive(load)
  const openHist = async (o) => { try { setHist({ o, rows: await api(`/api/orders/${o.id}/history`) }) } catch (e) { setErr(e.message) } }
  const doChange = async () => { setBusy(true); setErr(''); try { await api(`/api/orders/${chg.o.id}/status?to=${chg.to}`, { method: 'POST' }); setChg(null); load() } catch (e) { setErr(e.message); setChg(null) } setBusy(false) }
  return (<div className="page"><div className="row"><h2>{t('x_orders') === 'x_orders' ? 'Orders' : t('x_orders')}</h2><select value={flt} onChange={(e) => setFlt(e.target.value)}><option value="ALL">{t('all')}</option>{STATUSES.map((s) => <option key={s} value={s}>{t('st_' + s)}</option>)}</select></div><Err e={err} />
    <div className="panel tablewrap"><table><thead><tr><th>#</th><th>{T('x_customer', 'Customer')}</th><th>{T('x_items', 'Items')}</th><th>{t('total')}</th><th>{T('x_payment', 'Payment')}</th><th>{t('status')}</th><th>{T('x_updatedBy', 'Last updated by')}</th><th>{T('x_placed', 'Placed')}</th><th></th></tr></thead>
      <tbody>{os.filter((o) => flt === 'ALL' || o.status === flt).map((o) => (<tr key={o.id}><td>{o.id}</td><td>{o.customer}</td><td>{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</td><td>${m(o.total)}</td><td>{o.paymentMethod || <span className="muted">unpaid</span>}</td>
        <td><select className={'tag ' + o.status} value={o.status} disabled={['DELIVERED', 'CANCELLED'].includes(o.status)} onChange={(e) => setChg({ o, to: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{t('st_' + s)}</option>)}</select></td>
        <td>{o.updatedBy ? <><b>{o.updatedBy}</b><div className="muted">{fmt(o.updatedAt)}</div></> : <span className="muted">—</span>}</td><td>{fmt(o.createdAt)}</td>
        <td className="actions"><button className="mini" onClick={() => openHist(o)}><Icon n="clock" s={14} /> {T('x_history', 'History')}</button> {!['PENDING', 'CANCELLED'].includes(o.status) && <button className="mini" onClick={() => download(`/api/orders/${o.id}/receipt`, `receipt-${o.id}.pdf`).catch((e) => setErr(e.message))}><Icon n="download" s={14} /></button>}</td></tr>))}</tbody></table></div>
    {chg && <Confirm title="Change order status?" yes="Yes, change status" no="No, keep it" busy={busy} onYes={doChange} onNo={() => setChg(null)}>
      <div className="kv"><span>Order</span><b>#{chg.o.id}</b><span>Customer</span><b>{chg.o.customer}</b><span>Items</span><b>{chg.o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</b><span>Total</span><b>${m(chg.o.total)}</b>
        <span>Payment</span><b>{chg.o.paymentMethod ? `${chg.o.paymentMethod}${chg.o.paymentRef ? ' · ' + chg.o.paymentRef : ''}` : 'Not paid yet'}</b><span>Placed</span><b>{fmt(chg.o.createdAt)}</b></div>
      <div className="chgrow"><span className={'tag ' + chg.o.status}>{t('st_' + chg.o.status)}</span><Icon n="send" s={16} /><span className={'tag ' + chg.to}>{t('st_' + chg.to)}</span></div>
      <div className="notice"><Icon n="shield" s={16} />This change is recorded in the audit log under your name, and the customer is notified.</div></Confirm>}
    {hist && <div className="overlay" onClick={() => setHist(null)}><div className="modal wide" onClick={(e) => e.stopPropagation()}><h3>Order #{hist.o.id} — {T('x_history', 'History')}</h3>
      {hist.rows.length === 0 ? <p className="muted">No staff changes recorded yet.</p> : hist.rows.map((r) => <div className="toprow" key={r.id}><b>{r.actor}</b><span className="grow1">{r.detail}</span><small className="muted">{fmt(r.createdAt)}</small></div>)}<button className="btn ghost" onClick={() => setHist(null)}>{T('x_close', 'Close')}</button></div></div>}</div>)
}

const ROLE_HELP = 'Owner: everything, including finance and the audit log. Manager: products, purchasing, suppliers, discounts view, announcements, orders, chat. Staff: POS sales, orders (update status), receive purchase orders, customer chat, view products.'
export function Team({ me, t }) {
  const [us, setUs] = useState([]), [f, setF] = useState({ username: '', password: '', role: 'STAFF' }), [err, setErr] = useState(''), [ask, setAsk] = useState(null)
  const load = () => api('/api/users').then(setUs).catch((e) => setErr(e.message)); useEffect(() => { load() }, [])
  const add = async (e) => { e.preventDefault(); setErr(''); try { await api('/api/users', { method: 'POST', body: f }); setF({ username: '', password: '', role: 'STAFF' }); load() } catch (x) { setErr(x.message) } }
  const role = (u, r) => api(`/api/users/${u.id}/role`, { method: 'PUT', body: { role: r } }).then(load).catch((x) => setErr(x.message))
  const del = () => api(`/api/users/${ask.id}`, { method: 'DELETE' }).then(() => { setAsk(null); load() }).catch((x) => { setErr(x.message); setAsk(null) })
  return (<div className="page"><h2>{t('x_team') === 'x_team' ? 'Team & roles' : t('x_team')}</h2><p className="muted">{ROLE_HELP}</p><Err e={err} />
    <form className="panel row l wrap" onSubmit={add}><input placeholder="Username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required /><input placeholder="Password (6+)" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
      <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="STAFF">Staff</option><option value="MANAGER">Manager</option><option value="OWNER">Owner</option></select><button className="btn">Add team member</button></form>
    <div className="panel tablewrap"><table><thead><tr><th>Username</th><th>Role</th><th></th></tr></thead><tbody>{us.filter((u) => u.role !== 'CUSTOMER').map((u) => (<tr key={u.id}><td>{u.username}{u.username === me && <small className="muted"> (you)</small>}</td>
      <td><select value={u.role} disabled={u.username === me} onChange={(e) => role(u, e.target.value)}><option value="STAFF">Staff</option><option value="MANAGER">Manager</option><option value="OWNER">Owner</option></select></td><td>{u.username !== me && <button className="mini" onClick={() => setAsk(u)}><Icon n="trash" s={14} /></button>}</td></tr>))}</tbody></table></div>
    {ask && <Confirm title="Remove team member" danger yes="Remove" onYes={del} onNo={() => setAsk(null)}><p>Remove <b>{ask.username}</b> ({ask.role})? They will no longer be able to sign in.</p></Confirm>}</div>)
}

export function Audit({ t }) {
  const [rows, setRows] = useState([]), [who, setWho] = useState('ALL'), [err, setErr] = useState('')
  useEffect(() => { api('/api/audit').then(setRows).catch((e) => setErr(e.message)) }, [])
  const actors = [...new Set(rows.map((r) => r.actor))]
  return (<div className="page"><div className="row"><div><h2>{t('x_audit') === 'x_audit' ? 'Audit log' : t('x_audit')}</h2><small className="muted">Every sensitive change, with the employee who made it. Owner only.</small></div><select value={who} onChange={(e) => setWho(e.target.value)}><option value="ALL">All employees</option>{actors.map((a) => <option key={a}>{a}</option>)}</select></div><Err e={err} />
    <div className="panel tablewrap"><table><thead><tr><th>Time</th><th>Employee</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>{rows.filter((r) => who === 'ALL' || r.actor === who).map((r) => <tr key={r.id}><td>{fmt(r.createdAt)}</td><td><b>{r.actor}</b></td><td><span className="tag">{r.action}</span></td><td>{r.target}</td><td>{r.detail}</td></tr>)}</tbody></table>
      {rows.length === 0 && <p className="muted pad">No changes recorded yet.</p>}</div></div>)
}
