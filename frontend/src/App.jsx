import { useEffect, useState } from 'react'
import { api, store, useLive } from './api'
import { LANGS, mk } from './i18n'
import { Icon } from './Icons'
import Store, { Detail, CartDrawer } from './Store'
import ChatWidget from './ChatWidget'
import Bell from './Bell'
import { MyOrders, Inbox } from './Account'
import { Dashboard, Inventory, Catalog, Orders, Team, Audit } from './Admin'
import { POS, Purchasing, Suppliers, Finance, Discounts, Broadcast } from './Admin2'

const ALL = ['OWNER', 'MANAGER', 'STAFF'], BOSS = ['OWNER', 'MANAGER'], OWNER = ['OWNER']
const NAV = [['dash', 'grid', 'Dashboard', 'x_dash', BOSS], ['pos', 'cash', 'Point of sale', 'x_pos', ALL], ['orders', 'receipt', 'Orders', 'x_orders', ALL], ['inv', 'box', 'Products', 'x_inv', ALL], ['cat', 'tag', 'Catalog data', 'x_catalog', BOSS],
  ['po', 'truck', 'Purchasing', 'x_purchasing', ALL], ['sup', 'factory', 'Suppliers', 'x_suppliers', BOSS], ['fin', 'book', 'Finance', 'x_finance', OWNER], ['disc', 'percent', 'Discounts', 'x_discounts', OWNER],
  ['bc', 'megaphone', 'Announcements', 'x_broadcast', BOSS], ['inbox', 'chat', 'Customer chat', 'x_chat', ALL], ['team', 'users', 'Team & roles', 'x_team', OWNER], ['audit', 'shield', 'Audit log', 'x_audit', OWNER]]

function Login({ onDone, onClose }) {
  const [mode, setMode] = useState('login'), [u, setU] = useState(''), [p, setP] = useState(''), [err, setErr] = useState('')
  const go = async (e) => { e.preventDefault(); setErr(''); try { onDone(await api('/api/auth/' + mode, { method: 'POST', body: { username: u, password: p } })) } catch (x) { setErr(x.message) } }
  return (<div className="overlay"><form className="modal" onSubmit={go}><h3>Khit Ride</h3><small className="muted">{mode === 'login' ? 'Sign in to your account' : 'Create a customer account'}</small>
    <input placeholder="Username or email" value={u} onChange={(e) => setU(e.target.value)} required /><input placeholder="Password (6+ characters)" type="password" value={p} onChange={(e) => setP(e.target.value)} required />
    {err && <div className="alert"><Icon n="alert" s={16} />{err}</div>}<button className="btn full">{mode === 'login' ? 'Sign in' : 'Register'}</button>
    <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr('') }}>{mode === 'login' ? 'New customer? Create an account' : 'Have an account? Sign in'}</button><button type="button" className="link" onClick={onClose}>Cancel</button></form></div>)
}

export default function App() {
  const [user, setUser] = useState(store.get()), [show, setShow] = useState(false)
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'en'), [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')
  const t = mk(lang), role = user?.role, staff = ALL.includes(role)
  const allowed = NAV.filter((n) => n[4].includes(role)), first = allowed[0]?.[0] || 'orders'
  const [view, setView] = useState(staff ? 'admin' : 'store'), [apage, setApage] = useState(first), [spage, setSpage] = useState('shop'), [inboxFor, setInboxFor] = useState(null)
  const [ps, setPs] = useState([]), [cart, setCart] = useState({}), [q, setQ] = useState(''), [cat, setCat] = useState('All'), [sel, setSel] = useState(null), [drawer, setDrawer] = useState(false)
  const [wl, setWl] = useState(() => JSON.parse(localStorage.getItem('wl') || '[]'))
  const loadPs = () => api('/api/products').then(setPs).catch(() => {}); useEffect(() => { loadPs() }, []); useLive(loadPs)
  const add = (p, n = 1) => setCart((c) => ({ ...c, [p.id]: Math.min((c[p.id] || 0) + n, p.stock) })); const count = Object.values(cart).reduce((a, b) => a + b, 0)
  const toggleWl = (id) => { const n = wl.includes(id) ? wl.filter((x) => x !== id) : [...wl, id]; setWl(n); localStorage.setItem('wl', JSON.stringify(n)) }
  const done = (u) => { store.set(u); setUser(u); setShow(false); if (ALL.includes(u.role)) { setView('admin'); setApage(NAV.find((n) => n[4].includes(u.role))[0]) } else setView('store') }
  const logout = () => { store.clear(); setUser(null); setView('store'); setSpage('shop') }
  const flip = () => { const n = theme === 'dark' ? 'light' : 'dark'; setTheme(n); localStorage.setItem('theme', n) }
  const lbl = (n) => { const v = t(n[3]); return v === n[3] ? n[2] : v }
  const go = (link) => {
    if (!link) return
    if (staff && view === 'admin') { if (link.startsWith('inbox:')) { setInboxFor(link.slice(6)); setApage('inbox') } else if (link === 'orders') setApage('orders'); else if (link === 'inv') setApage('inv'); return }
    if (link === 'chat') window.dispatchEvent(new CustomEvent('openchat', { detail: 'staff' }))
    else if (link === 'orders') setSpage('orders'); else if (link === 'sale') { setSpage('sale'); setCat('All') } else if (link === 'shop') { setSpage('shop'); setCat('All') }
    else if (link.startsWith('product:')) { const p = ps.find((x) => x.id === +link.slice(8)); if (p) setSel(p) }
  }
  const cats = [...new Set(ps.map((p) => p.category).filter(Boolean))]
  const controls = (<><select className="mini-sel" value={lang} onChange={(e) => { setLang(e.target.value); localStorage.setItem('lang', e.target.value) }}>{Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
    <button className="icobtn" onClick={flip} aria-label="Theme"><Icon n={theme === 'dark' ? 'sun' : 'moon'} /></button></>)

  if (view === 'admin' && staff) {
    const cur = allowed.find((n) => n[0] === apage) ? apage : first, cn = allowed.find((n) => n[0] === cur)
    return (<div className="app bo" data-theme={theme}><aside className="sidebar"><div className="logo">KHIT<span>RIDE</span></div><small className="muted pad">{t('backoffice')}</small>
      {allowed.map((n) => <button key={n[0]} className={'snav' + (cur === n[0] ? ' on' : '')} onClick={() => setApage(n[0])}><Icon n={n[1]} s={17} />{lbl(n)}</button>)}<div className="grow1" /><small className="muted pad">{user.username} · {role}</small></aside>
      <div className="bmain"><header className="btop"><b>{lbl(cn)}</b><div className="grow1" />{controls}<Bell key={user.username} t={t} onGo={go} />
        <button className="btn ghost sm" onClick={() => setView('store')}><Icon n="store" s={16} /> {t('viewStore')}</button><button className="btn sm" onClick={logout}><Icon n="logout" s={16} /> {t('logout')}</button></header>
        <main>{cur === 'dash' && <Dashboard t={t} />}{cur === 'pos' && <POS t={t} />}{cur === 'orders' && <Orders t={t} />}{cur === 'inv' && <Inventory t={t} role={role} />}{cur === 'cat' && <Catalog t={t} />}{cur === 'po' && <Purchasing t={t} role={role} />}
          {cur === 'sup' && <Suppliers t={t} />}{cur === 'fin' && <Finance t={t} />}{cur === 'disc' && <Discounts t={t} />}{cur === 'bc' && <Broadcast t={t} />}{cur === 'inbox' && <Inbox t={t} initial={inboxFor} />}{cur === 'team' && <Team me={user.username} t={t} />}{cur === 'audit' && <Audit t={t} />}</main></div></div>)
  }
  return (<div className="app sf" data-theme={theme}>
    <div className="util"><span>Khit Ride · Bicycles, e-bikes & accessories</span><div className="row l">{controls}{staff && <button className="ulink" onClick={() => setView('admin')}>{t('backoffice')}</button>}{user?.role === 'CUSTOMER' && <button className="ulink" onClick={() => setSpage('orders')}>{t('mine')}</button>}
      {user ? <button className="ulink" onClick={logout}>{t('logout')} ({user.username})</button> : <button className="ulink" onClick={() => setShow(true)}>{t('login')}</button>}</div></div>
    <header className="navbar"><button className="wordmark" onClick={() => { setSpage('shop'); setCat('All'); setQ('') }}>KHIT<span>RIDE</span></button>
      <div className="grow1" />
      <div className="searchbox"><Icon n="search" s={16} /><input placeholder={t('search')} value={q} onChange={(e) => { setQ(e.target.value); if (spage === 'orders') setSpage('shop') }} /></div>
      {user && <Bell key={user.username} t={t} onGo={go} />}<button className="icobtn dark" onClick={() => setDrawer(true)} aria-label={t('cart')}><Icon n="cart" />{count > 0 && <span className="count">{count}</span>}</button></header>
    <nav className="catbar">{cats.map((c) => <button key={c} className={cat === c && spage === 'shop' ? 'on' : ''} onClick={() => { setSpage('shop'); setCat(c) }}>{t.c(c)}</button>)}<button className={'salelink' + (spage === 'sale' ? ' on' : '')} onClick={() => { setSpage('sale'); setCat('All') }}>{t('sale')}</button></nav>
    <main className="shopmain">{spage === 'orders' ? <MyOrders t={t} /> : <Store ps={ps} t={t} q={q} cat={cat} setCat={setCat} add={add} setSel={setSel} wl={wl} toggleWl={toggleWl} saleOnly={spage === 'sale'} />}</main>
    <footer className="footer"><div><b>KHIT RIDE</b><p className="muted">Quality bikes, honest advice. Chat with us any time.</p></div><div className="muted">© Khit Ride</div></footer>
    {!staff && <ChatWidget t={t} lang={lang} user={user} needLogin={() => setShow(true)} />}
    <CartDrawer open={drawer} onClose={() => setDrawer(false)} ps={ps} cart={cart} setCart={setCart} user={user} needLogin={() => setShow(true)} t={t} goOrders={() => setSpage('orders')} />
    {sel && <Detail p={sel} t={t} add={add} onClose={() => setSel(null)} />}{show && <Login onDone={done} onClose={() => setShow(false)} />}</div>)
}
