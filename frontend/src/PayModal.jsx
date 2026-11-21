import { useEffect, useState } from 'react'
import { api, download } from './api'
import { Icon } from './Icons'
const BRAND = { KBZPAY: ['KBZPay', '#1d4ea1'], WAVE: ['Wave Pay', '#d99a00'], AYAPAY: ['AYA Pay', '#c8102e'], CARD: ['Credit / debit card', '#1f2937'], COD: ['Cash on delivery', '#1e8e5a'] }
const luhn = (n) => { let s = 0, d = false; for (let i = n.length - 1; i >= 0; i--) { let x = +n[i]; if (d) { x *= 2; if (x > 9) x -= 9 } s += x; d = !d } return n.length >= 13 && s % 10 === 0 }
function Qr({ seed }) {
  let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const N = 21, cells = []
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { h = (h * 1664525 + 1013904223) >>> 0; const fin = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12); if (!fin && (h >>> 28) % 2) cells.push(<rect key={x + '-' + y} x={x} y={y} width="1" height="1" />) }
  const F = ([x, y]) => <g key={x + '-' + y}><rect x={x} y={y} width="7" height="7" /><rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" /><rect x={x + 2} y={y + 2} width="3" height="3" /></g>
  return <svg viewBox="-1 -1 23 23" className="qr"><rect x="-1" y="-1" width="23" height="23" fill="#fff" /><g fill="#111">{cells}{[[0, 0], [14, 0], [0, 14]].map(F)}</g></svg>
}

export default function PayModal({ order, method, onClose, onPaid }) {
  const [s, setS] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(null), [card, setCard] = useState({ no: '', exp: '', cvc: '' })
  const [name, color] = BRAND[method] || [method, '#1f2937']
  const start = () => { setErr(''); setS(null); api('/api/payments/start', { method: 'POST', body: { orderId: order.id, method } }).then((r) => { if (r.status === 'PAID') { setDone({ ref: 'COD-' + order.id }); onPaid && onPaid(r) } else setS(r) }).catch((e) => setErr(e.message)) }
  useEffect(() => { start() }, [])
  const confirm = async (approved, failMsg) => {
    setBusy(true); setErr('')
    try { const r = await api(`/api/payments/${s.sessionId}/confirm`, { method: 'POST', body: { approved } }); if (r.status === 'PAID') { setDone(r); onPaid && onPaid(r) } else { setErr(failMsg || 'The payment was not completed. No money was taken. You can try again or choose another method.'); setS(null) } }
    catch (e) { setErr(e.message) }
    setBusy(false)
  }
  const payCard = (e) => {
    e.preventDefault(); const no = card.no.replace(/\s/g, '')
    if (!luhn(no)) return setErr('That card number does not look right. Please check the digits.')
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.exp)) return setErr('Enter the expiry date as MM/YY.')
    if (!/^\d{3,4}$/.test(card.cvc)) return setErr('The security code (CVC) should be 3 or 4 digits.')
    confirm(no !== '4000000000000002', 'Your card was declined by the bank (test card). No money was taken. Try another card.')
  }
  return (<div className="overlay" onMouseDown={() => !busy && onClose(done)}><div className="modal paybox" onMouseDown={(e) => e.stopPropagation()}>
    <div className="payhead" style={{ background: color }}><b>{name}</b><span>Order #{order.id} · ${Number(order.total).toFixed(2)}</span></div>
    <div className="sandbox">Demo payment: no real money is charged.</div>
    {err && <div className="alert"><Icon n="alert" s={16} />{err}</div>}
    {done ? (<div className="paydone"><Icon n="check" s={34} /><h3>Payment successful</h3><p className="muted">Reference {done.ref}</p>
      <button className="btn full" onClick={() => download(`/api/orders/${order.id}/receipt`, `receipt-${order.id}.pdf`).catch((e) => setErr(e.message))}><Icon n="download" s={16} /> Download receipt (PDF)</button><button className="btn ghost full" onClick={() => onClose(done)}>Close</button></div>)
    : !s ? (err ? <div className="row l"><button className="btn" onClick={start}>Try again</button><button className="btn ghost" onClick={() => onClose(null)}>Close</button></div> : <p className="muted">Preparing your payment…</p>)
    : method === 'CARD' ? (<form onSubmit={payCard} className="cardform"><label>Card number<input inputMode="numeric" placeholder="4242 4242 4242 4242" value={card.no} onChange={(e) => setCard({ ...card, no: e.target.value.replace(/[^\d ]/g, '').slice(0, 23) })} /></label>
      <div className="row l"><label>Expiry<input placeholder="MM/YY" value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value.slice(0, 5) })} /></label><label>CVC<input inputMode="numeric" placeholder="123" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })} /></label></div>
      <small className="muted">Test card 4242 4242 4242 4242 succeeds. 4000 0000 0000 0002 is declined.</small>
      <button className="btn full" disabled={busy}>Pay ${Number(order.total).toFixed(2)}</button><button type="button" className="btn ghost full" onClick={() => confirm(false, 'Payment cancelled. Your order is still waiting; you can pay later from My orders.')}>Cancel payment</button></form>)
    : (<div className="qrbox"><Qr seed={s.sessionId} /><p>Open the <b>{name}</b> app, scan this code and approve <b>${Number(order.total).toFixed(2)}</b>.</p>
      <button className="btn full" disabled={busy} onClick={() => confirm(true)}>I have approved the payment (sandbox)</button><button className="btn ghost full" disabled={busy} onClick={() => confirm(false, 'Payment cancelled. Your order is still waiting; you can pay later from My orders.')}>Cancel payment</button></div>)}
  </div></div>)
}
