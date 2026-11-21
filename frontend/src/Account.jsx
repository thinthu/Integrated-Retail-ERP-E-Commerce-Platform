import { useEffect, useRef, useState } from 'react'
import { api, download, useLive } from './api'
import { Icon } from './Icons'
import PayModal from './PayModal'
const STEPS = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED']

export function MyOrders({ t }) {
  const [os, setOs] = useState([]), [err, setErr] = useState(''), [pay, setPay] = useState(null), [method, setMethod] = useState('KBZPAY')
  const load = () => api('/api/orders/mine').then(setOs).catch((e) => setErr(e.message))
  useEffect(() => { load() }, []); useLive(load, ['/topic/orders'])
  const cancel = (id) => confirm('Cancel this order? Items go back to stock.') && api(`/api/orders/${id}/cancel`, { method: 'POST' }).then(load).catch((e) => setErr(e.message))
  return (<div className="page"><h2>{t('mine')}</h2>{err && <div className="alert"><Icon n="alert" s={16} />{err}</div>}{os.length === 0 && <div className="panel">{t('noOrders')}</div>}
    {os.map((o) => { const idx = STEPS.indexOf(o.status); return (<div className="panel" key={o.id}>
      <div className="row"><b>#{o.id}</b><span className={'tag ' + o.status}>{t('st_' + o.status)}</span><b>${(+o.total).toFixed(2)}</b></div>
      <small className="muted">{new Date(o.createdAt).toLocaleString()} · {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}{o.paymentMethod ? ` · ${o.paymentMethod}` : ''}</small>
      {o.status !== 'CANCELLED' && o.status !== 'PENDING' && <div className="track">{STEPS.map((s, i) => <div key={s} className={'step' + (i <= idx ? ' done' : '')}><i /><small>{t('st_' + s)}</small></div>)}</div>}
      <div className="row l wrap">{o.status === 'PENDING' && <><select value={method} onChange={(e) => setMethod(e.target.value)}><option value="KBZPAY">KBZPay</option><option value="WAVE">Wave Pay</option><option value="AYAPAY">AYA Pay</option><option value="CARD">Card</option><option value="COD">Cash on delivery</option></select><button className="btn sm" onClick={() => setPay({ order: o, method })}>{t('payNow')}</button></>}
        {!['PENDING', 'CANCELLED'].includes(o.status) && <button className="mini" onClick={() => download(`/api/orders/${o.id}/receipt`, `receipt-${o.id}.pdf`).catch((e) => setErr(e.message))}><Icon n="download" s={14} /> {t('receipt')}</button>}
        {['PENDING', 'PAID', 'PROCESSING'].includes(o.status) && <button className="mini" onClick={() => cancel(o.id)}>Cancel order</button>}</div></div>) })}
    {pay && <PayModal order={pay.order} method={pay.method} onClose={() => { setPay(null); load() }} onPaid={load} />}</div>)
}

export function Thread({ msgs, mine, onSend, t }) {
  const [v, setV] = useState(''), end = useRef()
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])
  const go = (e) => { e.preventDefault(); if (v.trim()) { onSend(v); setV('') } }
  return (<div className="thread"><div className="msgs">{msgs.map((m) => <div key={m.id} className={'bubble ' + (m.sender === mine ? 'me' : 'them')}>{m.body}<small>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div>)}<div ref={end} /></div>
    <form className="compose" onSubmit={go}><input value={v} onChange={(e) => setV(e.target.value)} placeholder={t('type')} /><button className="btn" aria-label="Send"><Icon n="send" s={16} /></button></form></div>)
}

export function Inbox({ t, initial }) {
  const [th, setTh] = useState([]), [c, setC] = useState(initial || null), [m, setM] = useState([]), [err, setErr] = useState(''), cr = useRef(null); cr.current = c
  useEffect(() => { if (initial) setC(initial) }, [initial])
  const loadT = () => api('/api/support/admin/threads').then(setTh).catch((e) => setErr(e.message))
  const loadM = () => cr.current && api('/api/support/admin/thread/' + encodeURIComponent(cr.current)).then(setM).catch((e) => setErr(e.message))
  useEffect(() => { loadT() }, []); useEffect(() => { loadM() }, [c]); useLive(() => { loadT(); loadM() }, ['/topic/support'])
  return (<div className="page"><h2>{t('x_chat') === 'x_chat' ? 'Customer chat' : t('x_chat')}</h2>{err && <div className="alert"><Icon n="alert" s={16} />{err}</div>}<div className="inbox"><div className="panel threads">{th.length === 0 && <small className="muted">{t('noThreads')}</small>}
    {th.map((x) => <button key={x} className={'snav' + (x === c ? ' on' : '')} onClick={() => setC(x)}><Icon n="user" s={16} />{x}</button>)}</div>
    <div className="panel">{c ? <Thread msgs={m} mine="STAFF" t={t} onSend={(x) => api('/api/support/admin/thread/' + encodeURIComponent(c), { method: 'POST', body: { text: x } }).then(loadM).catch((e) => setErr(e.message))} /> : <small className="muted">Select a conversation</small>}</div></div></div>)
}
