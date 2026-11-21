import { useEffect, useRef, useState } from 'react'
import { api, useLive, useOutside } from './api'
import { Icon } from './Icons'
import { Thread } from './Account'
export default function ChatWidget({ t, lang, user, needLogin }) {
  const [open, setOpen] = useState(false), [tab, setTab] = useState('ai'), [msgs, setMsgs] = useState([]), [v, setV] = useState(''), [busy, setBusy] = useState(false), [mode, setMode] = useState('')
  const [staff, setStaff] = useState([]), [seen, setSeen] = useState(0), end = useRef(), box = useRef()
  useOutside(box, () => setOpen(false), open)
  const loadStaff = () => user && api('/api/support/mine').then(setStaff).catch(() => {})
  useEffect(() => { loadStaff() }, [user?.username]); useLive(loadStaff, ['/topic/support'])
  const staffIn = staff.filter((m) => m.sender === 'STAFF').length
  useEffect(() => { if (open && tab === 'staff') setSeen(staffIn) }, [open, tab, staffIn])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])
  const send = async (text) => {
    if (!text || !text.trim() || busy) return
    const history = msgs.map((m) => ({ role: m.role, content: m.content })); setMsgs((x) => [...x, { role: 'user', content: text }]); setV(''); setBusy(true)
    try { const r = await api('/api/chat', { method: 'POST', body: { message: text, history, lang } }); setMode(r.mode); setMsgs((x) => [...x, { role: 'assistant', content: r.reply }]) }
    catch (e) { setMsgs((x) => [...x, { role: 'assistant', content: e.message }]) }
    setBusy(false)
  }
  useEffect(() => {
    const ask = (e) => { setOpen(true); setTab('ai'); send(e.detail) }, openChat = (e) => { setOpen(true); setTab(e.detail || 'staff') }
    window.addEventListener('ask', ask); window.addEventListener('openchat', openChat); return () => { window.removeEventListener('ask', ask); window.removeEventListener('openchat', openChat) }
  })
  const unread = Math.max(0, staffIn - seen)
  return (<div ref={box}>
    <button className="launcher" onClick={() => setOpen(!open)}><Icon n="chat" />{t('chatUs')}{unread > 0 && !open && <span className="count">{unread}</span>}</button>
    {open && <div className="cw"><div className="cwhead"><div className="tabs"><button className={tab === 'ai' ? 'on' : ''} onClick={() => setTab('ai')}>{t('assistant')}</button>
      <button className={tab === 'staff' ? 'on' : ''} onClick={() => setTab('staff')}>{t('staffChat')}{unread > 0 && <span className="count">{unread}</span>}</button></div><button className="icobtn" onClick={() => setOpen(false)}><Icon n="close" s={16} /></button></div>
      {tab === 'ai' ? (<><div className="msgs"><div className="bubble them">{t('botHi')}</div>
        {msgs.length === 0 && <div className="sugg">{['s1', 's2', 's3'].map((k) => <button key={k} className="chip" onClick={() => send(t(k))}>{t(k)}</button>)}</div>}
        {msgs.map((m, i) => <div key={i} className={'bubble ' + (m.role === 'user' ? 'me' : 'them')} style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>)}{busy && <div className="bubble them">…</div>}<div ref={end} /></div>
        <form className="compose" onSubmit={(e) => { e.preventDefault(); send(v) }}><input value={v} onChange={(e) => setV(e.target.value)} placeholder={t('type')} /><button className="btn" aria-label="Send"><Icon n="send" s={16} /></button></form></>)
      : user ? <Thread msgs={staff} mine="CUSTOMER" t={t} onSend={(x) => api('/api/support/mine', { method: 'POST', body: { text: x } }).then(loadStaff).catch(() => {})} />
      : <div className="msgs"><p className="muted">{t('signChat')}</p><button className="btn" onClick={needLogin}>{t('login')}</button></div>}</div>}</div>)
}
