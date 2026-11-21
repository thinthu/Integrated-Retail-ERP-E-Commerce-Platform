import { useEffect, useRef, useState } from 'react'
import { api, useLive, useOutside } from './api'
import { Icon } from './Icons'
export default function Bell({ t, onGo }) {
  const [list, setList] = useState([]), [open, setOpen] = useState(false), [toast, setToast] = useState(null), last = useRef(0), ready = useRef(false), box = useRef()
  useOutside(box, () => setOpen(false), open)
  const load = () => api('/api/notices').then((x) => { const top = x[0]; if (ready.current && top && top.id > last.current && !top.seen) setToast(top); if (top) last.current = Math.max(last.current, top.id); ready.current = true; setList(x) }).catch(() => {})
  useEffect(() => { load() }, []); useLive(load, ['/topic/notify'])
  useEffect(() => { if (!toast) return; const i = setTimeout(() => setToast(null), 7000); return () => clearTimeout(i) }, [toast])
  const unseen = list.filter((n) => !n.seen).length
  const read = () => api('/api/notices/read', { method: 'POST' }).then(load).catch(() => {})
  const go = (n) => { setOpen(false); setToast(null); read(); onGo && onGo(n.link) }
  return (<div className="bellwrap" ref={box}><button className="icobtn" onClick={() => setOpen(!open)} aria-label={t('notif')}><Icon n="bell" />{unseen > 0 && <span className="count">{unseen}</span>}</button>
    {open && <div className="pop"><div className="row"><b>{t('notif')}</b><button className="link" onClick={read}>{t('markRead')}</button></div>
      {list.length === 0 && <small className="muted">{t('noNotif')}</small>}
      {list.map((n) => <button key={n.id} className={'nitem' + (n.seen ? '' : ' new')} onClick={() => go(n)}><b>{n.title}</b><div className="muted">{n.body}</div><small className="muted">{new Date(n.createdAt).toLocaleString()}</small></button>)}</div>}
    {toast && <button className="toast" onClick={() => go(toast)}><Icon n="bell" s={16} /><div><b>{toast.title}</b><div className="muted">{toast.body}</div></div></button>}</div>)
}
