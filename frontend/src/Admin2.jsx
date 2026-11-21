import { useEffect, useState } from 'react'
import { api, download, useLive } from './api'
import { Bars, Donut, Group, PAL } from './Charts'
import { Icon } from './Icons'
import { Confirm } from './Dialog'
import { Err, KPI, fmt, m, mkT, money } from './Admin'
const eff = (p) => (p.price * (100 - (p.salePercent || 0))) / 100

export function POS({ t }) {
  const T = mkT(t), [ps, setPs] = useState([]), [q, setQ] = useState(''), [cart, setCart] = useState({}), [method, setMethod] = useState('CASH'), [err, setErr] = useState(''), [done, setDone] = useState(null), [busy, setBusy] = useState(false)
  const load = () => api('/api/products').then(setPs).catch((e) => setErr(e.message)); useEffect(() => { load() }, []); useLive(load)
  const list = ps.filter((p) => p.stock > 0 && (p.name + p.sku + p.brand).toLowerCase().includes(q.toLowerCase())).slice(0, 30)
  const lines = Object.entries(cart).filter(([id, n]) => n > 0 && ps.find((p) => p.id === +id)).map(([id, qty]) => ({ productId: +id, qty }))
  const total = lines.reduce((s, l) => s + l.qty * eff(ps.find((p) => p.id === l.productId)), 0)
  const add = (p) => setCart((c) => ({ ...c, [p.id]: Math.min((c[p.id] || 0) + 1, p.stock) })), sub = (p) => setCart((c) => ({ ...c, [p.id]: Math.max((c[p.id] || 0) - 1, 0) }))
  const sell = async () => { setBusy(true); setErr(''); setDone(null); try { const o = await api('/api/orders/pos', { method: 'POST', body: { lines, method } }); setDone(o); setCart({}); load() } catch (e) { setErr(e.message) } setBusy(false) }
  return (<div className="page"><h2>{T('x_pos', 'Point of sale')}</h2><small className="muted">Walk-in sales. Stock, receipt and the audit log update automatically.</small><Err e={err} />
    {done && <div className="notice"><Icon n="check" s={16} />Sale #{done.id} completed — ${m(done.total)} by {done.paymentMethod}. <button className="link" onClick={() => download(`/api/orders/${done.id}/receipt`, `receipt-${done.id}.pdf`).catch((e) => setErr(e.message))}>Download receipt</button></div>}
    <div className="posgrid"><div className="panel"><input className="search" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="plist">{list.map((p) => <div className="prow2" key={p.id}><div><b>{p.name}</b><div className="muted">{p.sku} · {t('stock', { n: p.stock })}</div></div><div className="row l"><b>${m(eff(p))}</b><button className="btn sm" onClick={() => add(p)}><Icon n="plus" s={14} /></button></div></div>)}</div></div>
      <div className="panel"><h3>{t('cart')}</h3>{lines.length === 0 && <small className="muted">{t('empty')}</small>}
        {lines.map((l) => { const p = ps.find((x) => x.id === l.productId); return <div className="prow2" key={l.productId}><span>{p.name}</span><span className="row l"><button className="mini" onClick={() => sub(p)}>−</button>{l.qty}<button className="mini" onClick={() => add(p)}>+</button></span></div> })}
        <div className="prow"><b>{t('total')}</b><b>${m(total)}</b></div>
        <select value={method} onChange={(e) => setMethod(e.target.value)}><option value="CASH">Cash</option><option value="CARD">Card terminal</option><option value="KBZPAY">KBZPay (scan)</option><option value="WAVE">Wave Pay (scan)</option></select>
        <button className="btn full" disabled={!lines.length || busy} onClick={sell}>Complete sale</button></div></div></div>)
}

export function Purchasing({ t, role }) {
  const T = mkT(t), boss = role !== 'STAFF', [pos, setPos] = useState([]), [sups, setSups] = useState([]), [ps, setPs] = useState([]), [err, setErr] = useState(''), [ok, setOk] = useState(''), [form, setForm] = useState(null), [ask, setAsk] = useState(null)
  const load = () => api('/api/purchase-orders').then(setPos).catch((e) => setErr(e.message))
  useEffect(() => { load(); api('/api/products').then(setPs).catch(() => {}); if (boss) api('/api/suppliers').then(setSups).catch(() => {}) }, [])
  const run = async () => { try { await api(`/api/purchase-orders/${ask.po.id}/${ask.what}`, { method: 'POST' }); setOk(ask.msg); setAsk(null); load() } catch (e) { setErr(e.message); setAsk(null) } }
  const submit = async (ordered) => {
    setErr(''); try { await api('/api/purchase-orders', { method: 'POST', body: { supplierId: form.supplierId ? +form.supplierId : null, ordered, lines: form.lines.filter((l) => l.productId).map((l) => ({ productId: +l.productId, qty: +l.qty, unitCost: l.unitCost === '' ? null : +l.unitCost })) } }); setForm(null); setOk('Purchase order saved.'); load() } catch (e) { setErr(e.message) }
  }
  const setLine = (i, k, v) => setForm({ ...form, lines: form.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) })
  const opts = form ? ps.filter((p) => !form.supplierId || String(p.supplierId) === String(form.supplierId)) : []
  const btn = (po, what, label, msg, danger) => <button className={'btn sm' + (danger ? ' ghost' : '')} onClick={() => setAsk({ po, what, label, msg })}>{label}</button>
  return (<div className="page"><div className="row"><h2>{T('x_purchasing', 'Purchasing')}</h2>{boss && <button className="btn" onClick={() => setForm({ supplierId: '', lines: [{ productId: '', qty: 1, unitCost: '' }] })}><Icon n="plus" s={16} /> New purchase order</button>}</div>
    <small className="muted">Buy stock from suppliers. Receiving a purchase order adds the stock and updates the average cost price automatically.</small><Err e={err} />{ok && <div className="notice"><Icon n="check" s={16} />{ok}</div>}
    {form && <div className="panel"><h3>New purchase order</h3><label className="block">{T('x_supplier', 'Supplier')}<select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}><option value="">Choose supplier…</option>{sups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      {form.lines.map((l, i) => <div className="row l wrap" key={i}><select value={l.productId} onChange={(e) => setLine(i, 'productId', e.target.value)}><option value="">Product…</option>{opts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <input className="num" type="number" min="1" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} title="Quantity" /><input className="num" type="number" step="0.01" min="0" placeholder="Unit cost" value={l.unitCost} onChange={(e) => setLine(i, 'unitCost', e.target.value)} />
        <button className="mini" onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}><Icon n="trash" s={14} /></button></div>)}
      <div className="row l"><button className="btn ghost sm" onClick={() => setForm({ ...form, lines: [...form.lines, { productId: '', qty: 1, unitCost: '' }] })}><Icon n="plus" s={14} /> Add line</button></div>
      <div className="row l"><button className="btn" onClick={() => submit(true)}>Save & send to supplier</button><button className="btn ghost" onClick={() => submit(false)}>Save as draft</button><button className="btn ghost" onClick={() => setForm(null)}>{T('x_cancel', 'Cancel')}</button></div></div>}
    {pos.map((po) => <div className="panel" key={po.id}><div className="row"><div><b>PO #{po.id}</b> · {po.supplierName}<div className="muted">Created {fmt(po.createdAt)} by {po.createdBy}{po.receivedAt ? ` · Received ${fmt(po.receivedAt)} by ${po.receivedBy}` : ''}</div></div>
      <div className="row l"><span className={'tag ' + po.status}>{po.status}</span>{po.paid ? <span className="tag PAID">PAID</span> : <span className="tag PENDING">UNPAID</span>}<b>{money(po.total)}</b></div></div>
      <div className="muted">{po.lines.map((l) => `${l.qty}× ${l.name} @ $${m(l.unitCost)}`).join(' · ')}</div>
      <div className="row l wrap">{po.status === 'DRAFT' && boss && btn(po, 'order', 'Send to supplier', 'Purchase order sent to the supplier.')}
        {po.status === 'ORDERED' && btn(po, 'receive', T('x_receive', 'Receive stock'), 'Stock received and cost price updated.')}
        {role === 'OWNER' && ['ORDERED', 'RECEIVED'].includes(po.status) && !po.paid && btn(po, 'pay', 'Mark as paid', 'Supplier payment recorded.')}
        {boss && ['DRAFT', 'ORDERED'].includes(po.status) && !po.paid && btn(po, 'cancel', 'Cancel order', 'Purchase order cancelled.', true)}</div></div>)}
    {pos.length === 0 && <div className="panel muted">No purchase orders yet.</div>}
    {ask && <Confirm title={ask.label} yes="Yes, continue" no="No" onYes={run} onNo={() => setAsk(null)}><p>PO #{ask.po.id} from <b>{ask.po.supplierName}</b> — {money(ask.po.total)}.</p><div className="notice"><Icon n="shield" s={16} />This action is recorded in the audit log under your name.</div></Confirm>}</div>)
}

export function Suppliers({ t }) {
  const T = mkT(t), [rows, setRows] = useState([]), [f, setF] = useState(null), [err, setErr] = useState(''), [ask, setAsk] = useState(null)
  const load = () => api('/api/suppliers').then(setRows).catch((e) => setErr(e.message)); useEffect(() => { load() }, [])
  const save = async (e) => { e.preventDefault(); setErr(''); try { await api(f.id ? `/api/suppliers/${f.id}` : '/api/suppliers', { method: f.id ? 'PUT' : 'POST', body: f }); setF(null); load() } catch (x) { setErr(x.message) } }
  const del = async () => { try { await api(`/api/suppliers/${ask.id}`, { method: 'DELETE' }); setAsk(null); load() } catch (x) { setErr(x.message); setAsk(null) } }
  return (<div className="page"><div className="row"><h2>{T('x_suppliers', 'Suppliers')}</h2><button className="btn" onClick={() => setF({ name: '', contact: '', phone: '', email: '', country: '' })}><Icon n="plus" s={16} /> {T('x_add', 'Add')}</button></div><Err e={err} />
    {f && <form className="panel pform" onSubmit={save}><div className="fgrid">{['name', 'contact', 'phone', 'email', 'country'].map((k) => <label key={k}>{k[0].toUpperCase() + k.slice(1)}<input value={f[k] || ''} required={k === 'name'} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>)}</div>
      <div className="row l"><button className="btn">{T('x_save', 'Save')}</button><button type="button" className="btn ghost" onClick={() => setF(null)}>{T('x_cancel', 'Cancel')}</button></div></form>}
    <div className="panel tablewrap"><table><thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th>Email</th><th>Country</th><th></th></tr></thead><tbody>{rows.map((s) => <tr key={s.id}><td><b>{s.name}</b></td><td>{s.contact}</td><td>{s.phone}</td><td>{s.email}</td><td>{s.country}</td>
      <td className="actions"><button className="mini" onClick={() => setF(s)}><Icon n="edit" s={14} /></button> <button className="mini" onClick={() => setAsk(s)}><Icon n="trash" s={14} /></button></td></tr>)}</tbody></table></div>
    {ask && <Confirm title="Delete supplier" danger yes={T('x_delete', 'Delete')} onYes={del} onNo={() => setAsk(null)}><p>Delete <b>{ask.name}</b>? It can only be deleted if no product or purchase order uses it.</p></Confirm>}</div>)
}

const Row = ({ l, v, cls = '' }) => <tr className={cls}><td>{l}</td><td>{money(v)}</td></tr>
const CATS = ['Rent', 'Salaries', 'Utilities', 'Marketing', 'Maintenance', 'Other']
export function Finance({ t }) {
  const T = mkT(t), [tab, setTab] = useState('overview'), [st, setSt] = useState(null), [mo, setMo] = useState([]), [items, setItems] = useState([]), [sup, setSup] = useState([]), [exp, setExp] = useState([]), [err, setErr] = useState('')
  const [cap, setCap] = useState(''), [sf, setSf] = useState('ALL'), [loss, setLoss] = useState(false), [ef, setEf] = useState({ category: 'Rent', amount: '', note: '', date: '' }), [ask, setAsk] = useState(null), [ok, setOk] = useState('')
  const load = () => { api('/api/finance/statements').then((r) => { setSt(r); setCap(String(r.balance.ownerCapital)) }).catch((e) => setErr(e.message)); api('/api/finance/monthly').then(setMo).catch(() => {}); api('/api/finance/items').then(setItems).catch(() => {}); api('/api/finance/suppliers').then(setSup).catch(() => {}); api('/api/expenses').then(setExp).catch(() => {}) }
  useEffect(() => { load() }, [])
  if (!st) return <div className="page"><Err e={err} />Loading…</div>
  const inc = st.income, bal = st.balance
  const saveCap = async () => { setErr(''); try { await api('/api/finance/capital', { method: 'PUT', body: { amount: +cap } }); setOk('Owner capital saved.'); load() } catch (e) { setErr(e.message) } }
  const addExp = async (e) => { e.preventDefault(); setErr(''); try { await api('/api/expenses', { method: 'POST', body: { ...ef, amount: +ef.amount } }); setEf({ ...ef, amount: '', note: '' }); load() } catch (x) { setErr(x.message) } }
  const delExp = async () => { try { await api(`/api/expenses/${ask.id}`, { method: 'DELETE' }); setAsk(null); load() } catch (x) { setErr(x.message); setAsk(null) } }
  const shown = items.filter((i) => (sf === 'ALL' || String(i.supplierId) === sf) && (!loss || !i.profitable || i.marginPct < 10))
  const chartM = mo.map((x) => ({ l: x.month.slice(2), revenue: x.revenue, cogs: x.cogs, expenses: x.expenses }))
  const expCats = Object.entries(inc.expenses).map(([k, v]) => ({ k, v }))
  return (<div className="page"><h2>{T('x_finance', 'Finance')}</h2><small className="muted">Owner only. Income statement, balance sheet, equity, supplier and item profitability.</small><Err e={err} />{ok && <div className="notice"><Icon n="check" s={16} />{ok}</div>}
    <div className="tabs2">{[['overview', 'Overview'], ['items', 'Items & suppliers'], ['expenses', 'Expenses']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
    {tab === 'overview' && <>
      <div className="kpis"><KPI label="Net revenue" value={inc.netRevenue} prefix="$" color={PAL[0]} icon="chart" /><KPI label={T('x_grossprofit', 'Gross profit')} value={inc.grossProfit} prefix="$" color={PAL[1]} icon="tag" />
        <KPI label={T('x_netincome', 'Net income')} value={inc.netIncome} prefix="$" color={PAL[2]} icon="book" /><KPI label={T('x_equity', 'Equity')} value={bal.totalEquity} prefix="$" color={PAL[5]} icon="cash" /></div>
      <div className="panel"><h3>Last 6 months</h3><Group data={chartM} keys={['revenue', 'cogs', 'expenses']} colors={[PAL[0], PAL[2], PAL[4]]} />
        <div className="legendrow"><span><i style={{ background: PAL[0] }} />Revenue</span><span><i style={{ background: PAL[2] }} />Cost of goods</span><span><i style={{ background: PAL[4] }} />Expenses</span></div>
        <div className="tablewrap"><table><thead><tr><th>Month</th><th>Revenue</th><th>COGS</th><th>Expenses</th><th>Net profit</th></tr></thead><tbody>{mo.map((x) => <tr key={x.month}><td>{x.month}</td><td>{money(x.revenue)}</td><td>{money(x.cogs)}</td><td>{money(x.expenses)}</td><td className={x.profit < 0 ? 'warn' : 'ok'}><b>{money(x.profit)}</b></td></tr>)}</tbody></table></div></div>
      <div className="grid2eq"><div className="panel"><h3>{T('x_income', 'Income statement')}</h3><table className="stmt"><tbody>
        <Row l="Gross sales (list prices)" v={inc.grossSales} /><Row l="− Discounts given" v={inc.discounts} cls="sub" /><Row l="Net revenue" v={inc.netRevenue} cls="tot" /><Row l={'− ' + T('x_cogs', 'Cost of goods sold')} v={inc.cogs} />
        <Row l={`${T('x_grossprofit', 'Gross profit')} (${inc.grossMarginPct}%)`} v={inc.grossProfit} cls="tot" />{Object.entries(inc.expenses).map(([k, v]) => <Row key={k} l={'− ' + k} v={v} cls="sub" />)}
        <Row l={`${T('x_netincome', 'Net income')} (${inc.netMarginPct}%)`} v={inc.netIncome} cls="tot" /></tbody></table>
        <small className="muted">COGS uses the cost price saved at the moment of each sale, so profit stays accurate when costs change.</small></div>
      <div className="panel"><h3>{T('x_balance', 'Balance sheet')}</h3><table className="stmt"><tbody>
        <tr className="tot"><td>{T('x_assets', 'Assets')}</td><td></td></tr><Row l={T('x_cash', 'Cash')} v={bal.cash} cls="sub" /><Row l={T('x_inventory', 'Inventory (at cost)')} v={bal.inventory} cls="sub" /><Row l="Prepaid to suppliers" v={bal.prepaid} cls="sub" /><Row l="Total assets" v={bal.totalAssets} cls="tot" />
        <tr className="tot"><td>{T('x_liab', 'Liabilities')}</td><td></td></tr><Row l={T('x_payables', 'Accounts payable (unpaid supplier bills)')} v={bal.payables} cls="sub" />
        <tr className="tot"><td>{T('x_equity', 'Equity')}</td><td></td></tr><Row l={T('x_capital', "Owner's capital")} v={bal.ownerCapital} cls="sub" /><Row l="Retained earnings (net income)" v={bal.retainedEarnings} cls="sub" /><Row l="Opening stock & adjustments" v={bal.adjustments} cls="sub" /><Row l="Total equity" v={bal.totalEquity} cls="tot" />
        <Row l="Liabilities + Equity" v={bal.totalLiabilitiesAndEquity} cls="tot" /></tbody></table>
        <div className="row l"><label>{T('x_capital', "Owner's capital")} ($)<input type="number" min="0" value={cap} onChange={(e) => setCap(e.target.value)} /></label><button className="btn sm" onClick={saveCap}>{T('x_save', 'Save')}</button></div>
        <small className="muted">Equity = Assets − Liabilities. Assets always equal Liabilities + Equity. Cash = capital + sales − supplier payments − expenses.</small></div></div></>}
    {tab === 'items' && <>
      <div className="grid2eq"><div className="panel"><h3>Most profitable items ($)</h3><Bars data={items.slice(0, 8).map((i) => ({ l: i.name.split(' ').slice(0, 2).join(' ').slice(0, 9), v: Math.round(i.profit) }))} /></div>
        <div className="panel"><h3>Profit by supplier ($)</h3><Bars data={sup.map((s) => ({ l: s.name.slice(0, 9), v: Math.round(s.profit) }))} /></div></div>
      <div className="panel tablewrap"><h3>{T('x_suppliers', 'Suppliers')}</h3><table><thead><tr><th>Supplier</th><th>Products</th><th>Purchased (received POs)</th><th>Stock value</th><th>Units sold</th><th>Revenue</th><th>Profit</th></tr></thead>
        <tbody>{sup.map((s) => <tr key={s.id}><td><b>{s.name}</b></td><td>{s.products}</td><td>{money(s.purchased)}</td><td>{money(s.inventoryValue)}</td><td>{s.unitsSold}</td><td>{money(s.revenue)}</td><td className={s.profit < 0 ? 'warn' : 'ok'}><b>{money(s.profit)}</b></td></tr>)}</tbody></table></div>
      <div className="row l wrap"><select value={sf} onChange={(e) => setSf(e.target.value)}><option value="ALL">All suppliers</option>{sup.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><label className="radio"><input type="checkbox" checked={loss} onChange={(e) => setLoss(e.target.checked)} />Only loss-making or thin margin (&lt;10%)</label></div>
      <div className="panel tablewrap scroll"><table><thead><tr><th>Item</th><th>{T('x_supplier', 'Supplier')}</th><th>{T('x_cost', 'Cost')}</th><th>List price</th><th>Selling price</th><th>{T('x_margin', 'Margin')}</th><th>Result</th><th>Sold</th><th>{T('x_profit', 'Profit')}</th></tr></thead>
        <tbody>{shown.map((i) => <tr key={i.id}><td>{i.name}</td><td>{i.supplier}</td><td>{money(i.cost)}</td><td>{money(i.price)}</td><td>{money(i.effective)}{i.salePercent > 0 && <small className="muted"> (-{i.salePercent}%)</small>}</td><td>{i.marginPct}%</td>
          <td>{!i.profitable ? <span className="tag CANCELLED">Selling at a loss</span> : i.marginPct < 10 ? <span className="tag PENDING">Thin margin</span> : <span className="tag PAID">Profit</span>}</td><td>{i.unitsSold}</td><td className={i.profit < 0 ? 'warn' : ''}><b>{money(i.profit)}</b></td></tr>)}</tbody></table></div></>}
    {tab === 'expenses' && <>
      <div className="grid2eq"><form className="panel" onSubmit={addExp}><h3>Add expense</h3><div className="fgrid"><label>Category<select value={ef.category} onChange={(e) => setEf({ ...ef, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Amount ($)<input type="number" step="0.01" min="0" value={ef.amount} onChange={(e) => setEf({ ...ef, amount: e.target.value })} required /></label><label>Date<input type="date" value={ef.date} onChange={(e) => setEf({ ...ef, date: e.target.value })} /></label><label>Note<input value={ef.note} onChange={(e) => setEf({ ...ef, note: e.target.value })} /></label></div><button className="btn">{T('x_add', 'Add')}</button></form>
        <div className="panel"><h3>By category</h3><div className="donutrow"><Donut data={expCats} /><div className="legend">{expCats.map((c, i) => <div key={c.k}><i style={{ background: PAL[i % PAL.length] }} />{c.k}: {money(c.v)}</div>)}</div></div></div></div>
      <div className="panel tablewrap scroll"><table><thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Note</th><th>By</th><th></th></tr></thead><tbody>{exp.map((e) => <tr key={e.id}><td>{fmt(e.spentAt)}</td><td>{e.category}</td><td>{money(e.amount)}</td><td>{e.note}</td><td>{e.createdBy}</td><td><button className="mini" onClick={() => setAsk(e)}><Icon n="trash" s={14} /></button></td></tr>)}</tbody></table></div></>}
    {ask && <Confirm title="Delete expense" danger yes={T('x_delete', 'Delete')} onYes={delExp} onNo={() => setAsk(null)}><p>Delete the {ask.category} expense of {money(ask.amount)}?</p></Confirm>}</div>)
}

export function Discounts({ t }) {
  const T = mkT(t), [minM, setMinM] = useState(10), [pct, setPct] = useState(10), [rows, setRows] = useState([]), [sel, setSel] = useState([]), [scope, setScope] = useState('IDS'), [cat, setCat] = useState(''), [force, setForce] = useState(false), [res, setRes] = useState(null), [err, setErr] = useState(''), [q, setQ] = useState('')
  const load = () => api(`/api/finance/discount-plan?minMargin=${Number(minM) || 0}`).then(setRows).catch((e) => setErr(e.message)); useEffect(() => { load() }, [minM])
  const cats = [...new Set(rows.map((r) => r.category))], p = Number(pct) || 0
  const target = scope === 'ALL' ? rows : scope === 'CATEGORY' ? rows.filter((r) => r.category === cat) : rows.filter((r) => sel.includes(r.id))
  const ok = (r) => p <= r.maxSafePct || (force && p <= r.breakEvenPct)
  const okCount = target.filter(ok).length, minSafe = target.length ? Math.min(...target.map((r) => r.maxSafePct)) : 0
  const body = { scope, ids: sel, category: cat, percent: p, minMargin: Number(minM) || 0, force }
  const apply = () => { setErr(''); setRes(null); api('/api/promotions/apply', { method: 'POST', body }).then((r) => { setRes(r); load() }).catch((e) => setErr(e.message)) }
  const clear = () => { setErr(''); setRes(null); api('/api/promotions/clear', { method: 'POST', body }).then((r) => { setRes({ cleared: r.cleared }); load() }).catch((e) => setErr(e.message)) }
  const toggle = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])
  const shown = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()))
  return (<div className="page"><h2>{T('x_discounts', 'Discounts')}</h2><small className="muted">See how much discount each item can afford, then apply a sale to selected items, a category or everything. Customers see the sale price and a Sale page.</small><Err e={err} />
    <div className="panel"><div className="row l wrap"><label>Minimum margin to keep (%)<input className="num" type="number" min="0" max="90" value={minM} onChange={(e) => setMinM(e.target.value)} /></label>
      <label>Discount (%)<input className="num" type="number" min="1" max="90" value={pct} onChange={(e) => setPct(e.target.value)} /></label>
      <label>Apply to<select value={scope} onChange={(e) => setScope(e.target.value)}><option value="IDS">Selected items ({sel.length})</option><option value="CATEGORY">A category</option><option value="ALL">All items</option></select></label>
      {scope === 'CATEGORY' && <label>Category<select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Choose…</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></label>}
      <label className="radio"><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />Allow below the minimum margin (never below cost)</label></div>
      <div className="notice"><Icon n="percent" s={16} />{target.length === 0 ? 'Choose items to see what discount is possible.' : `For these ${target.length} item(s) the largest discount that keeps ${minM}% margin is ${minSafe}%. At ${p}%, ${okCount} item(s) can be discounted and ${target.length - okCount} would be skipped.`}</div>
      <div className="row l wrap"><button className="btn" disabled={!target.length || p < 1} onClick={apply}>{T('x_apply', 'Apply discount')}</button><button className="btn ghost" disabled={!target.length} onClick={clear}>{T('x_clear', 'Remove discounts')}</button></div>
      {res && (res.cleared != null ? <div className="notice"><Icon n="check" s={16} />Removed the discount from {res.cleared} item(s).</div> : <div className="notice"><Icon n="check" s={16} />Applied to {res.applied} item(s).{res.skipped.length > 0 && <> Skipped {res.skipped.length} (too deep for their margin): {res.skipped.slice(0, 5).map((s) => `${s.name} (max ${s.maxSafe}%)`).join(', ')}{res.skipped.length > 5 ? '…' : ''}</>}</div>)}</div>
    <input className="search" placeholder="Search items…" value={q} onChange={(e) => setQ(e.target.value)} />
    <div className="panel tablewrap scroll"><table><thead><tr><th></th><th>Item</th><th>{T('x_cost', 'Cost')}</th><th>Price</th><th>Margin now</th><th>Break-even discount</th><th>Max discount (keeps {minM}%)</th><th>Current sale</th><th>At {p}%: new price</th><th>New margin</th><th></th></tr></thead>
      <tbody>{shown.map((r) => { const np = (r.price * (100 - p)) / 100, nm = np > 0 ? ((np - r.cost) / np) * 100 : 0; return (<tr key={r.id}><td><input type="checkbox" checked={sel.includes(r.id)} onChange={() => toggle(r.id)} /></td><td>{r.name}</td><td>{money(r.cost)}</td><td>{money(r.price)}</td><td>{r.marginPct}%</td><td>{r.breakEvenPct}%</td><td><b>{r.maxSafePct}%</b></td><td>{r.salePercent > 0 ? <span className="tag PENDING">-{r.salePercent}%</span> : '—'}</td><td>{money(np)}</td><td className={nm < 0 ? 'warn' : ''}>{nm.toFixed(1)}%</td>
        <td>{p <= r.maxSafePct ? <span className="tag PAID">OK</span> : p <= r.breakEvenPct ? <span className="tag PENDING">Below target</span> : <span className="tag CANCELLED">Loss</span>}</td></tr>) })}</tbody></table></div></div>)
}

const TEMPLATES = [{ label: 'New arrival', title: 'New arrival at Khit Ride!', body: 'Our newest bikes have just landed. Come and take a look.', link: 'shop' }, { label: 'Back in stock', title: 'Back in stock!', body: 'The bikes you were waiting for are available again.', link: 'shop' }, { label: 'Weekly sale', title: "This week's sale", body: 'Selected bikes and accessories are discounted this week. Limited stock!', link: 'sale' }]
export function Broadcast({ t }) {
  const T = mkT(t), [f, setF] = useState({ title: '', body: '', link: '', audience: 'ALL', users: [] }), [custs, setCusts] = useState([]), [ps, setPs] = useState([]), [hist, setHist] = useState([]), [err, setErr] = useState(''), [ok, setOk] = useState(''), [q, setQ] = useState(''), [busy, setBusy] = useState(false)
  const load = () => api('/api/broadcasts').then(setHist).catch((e) => setErr(e.message)); useEffect(() => { load(); api('/api/users/customers').then(setCusts).catch(() => {}); api('/api/products').then(setPs).catch(() => {}) }, [])
  const send = async () => { setBusy(true); setErr(''); setOk(''); try { const b = await api('/api/broadcasts', { method: 'POST', body: f }); setOk(`Sent to ${b.recipients} customer(s).`); setF({ ...f, title: '', body: '' }); load() } catch (e) { setErr(e.message) } setBusy(false) }
  const tog = (u) => setF({ ...f, users: f.users.includes(u) ? f.users.filter((x) => x !== u) : [...f.users, u] })
  return (<div className="page"><h2>{T('x_broadcast', 'Announcements')}</h2><small className="muted">Send a notification to all customers or to chosen customers (new items, back in stock, weekly sale). Tapping it opens the page you pick.</small><Err e={err} />{ok && <div className="notice"><Icon n="check" s={16} />{ok}</div>}
    <div className="grid2eq"><div className="panel"><div className="row l wrap">{TEMPLATES.map((x) => <button key={x.label} className="chip" onClick={() => setF({ ...f, title: x.title, body: x.body, link: x.link })}>{x.label}</button>)}</div>
      <label className="block">Title<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label><label className="block">Message<textarea rows="3" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></label>
      <label className="block">When tapped, open<select value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })}><option value="">Nothing</option><option value="shop">Shop home</option><option value="sale">Sale page</option>{ps.map((p) => <option key={p.id} value={'product:' + p.id}>Product: {p.name}</option>)}</select></label>
      <div className="row l"><label className="radio"><input type="radio" checked={f.audience === 'ALL'} onChange={() => setF({ ...f, audience: 'ALL' })} />All customers ({custs.length})</label><label className="radio"><input type="radio" checked={f.audience === 'USERS'} onChange={() => setF({ ...f, audience: 'USERS' })} />Selected customers</label></div>
      {f.audience === 'USERS' && <div><input className="search" placeholder="Search customers…" value={q} onChange={(e) => setQ(e.target.value)} /><div className="scroll chk">{custs.filter((c) => c.toLowerCase().includes(q.toLowerCase())).map((c) => <label key={c} className="radio"><input type="checkbox" checked={f.users.includes(c)} onChange={() => tog(c)} />{c}</label>)}</div><small className="muted">{f.users.length} selected</small></div>}
      <button className="btn full" disabled={busy} onClick={send}>{T('x_send', 'Send')}</button></div>
      <div className="panel"><h3>Recent announcements</h3>{hist.length === 0 && <small className="muted">None sent yet.</small>}{hist.map((h) => <div className="toprow" key={h.id}><div className="grow1"><b>{h.title}</b><div className="muted">{h.body}</div><small className="muted">{h.audience} · {h.sentBy} · {fmt(h.createdAt)}</small></div></div>)}</div></div></div>)
}
