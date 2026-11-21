import { useEffect, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client/dist/sockjs'
export const API = import.meta.env.VITE_API || 'http://localhost:8081'
export const store = { get: () => JSON.parse(localStorage.getItem('user') || 'null'), set: (u) => localStorage.setItem('user', JSON.stringify(u)), clear: () => localStorage.removeItem('user') }
const MSG = {
  en: { net: "We can't reach the server right now. Please check your internet connection and try again in a moment.", auth: 'Please sign in to continue. Your session may have expired.', deny: 'Your account is not allowed to do this. Ask the Owner for access.', nf: "We couldn't find what you asked for.", srv: 'Something went wrong on our side. Please try again in a moment.' },
  my: { net: 'ဆာဗာနှင့် ယခု ချိတ်ဆက်၍မရပါ။ အင်တာနက်ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ခဏအကြာ ထပ်ကြိုးစားပါ။', auth: 'ဆက်လက်လုပ်ဆောင်ရန် ဝင်ရောက်ပါ။ သင့်အကောင့်ချိတ်ဆက်မှု သက်တမ်းကုန်သွားနိုင်ပါသည်။', deny: 'သင့်အကောင့်တွင် ဤလုပ်ဆောင်ချက်အတွက် ခွင့်ပြုချက် မရှိပါ။ ပိုင်ရှင်ထံ တောင်းဆိုပါ။', nf: 'သင်ရှာနေသည့်အရာကို မတွေ့ပါ။', srv: 'ကျွန်ုပ်တို့ဘက်တွင် ပြဿနာရှိနေပါသည်။ ခဏအကြာ ထပ်ကြိုးစားပါ။' },
  ja: { net: '現在サーバーに接続できません。インターネット接続を確認して、しばらくしてからもう一度お試しください。', auth: '続行するにはログインしてください。セッションの有効期限が切れた可能性があります。', deny: 'このアカウントにはこの操作の権限がありません。オーナーに権限を依頼してください。', nf: 'お探しの情報が見つかりませんでした。', srv: 'サーバー側で問題が発生しました。しばらくしてからもう一度お試しください。' },
}
export class ApiError extends Error { constructor(m, status) { super(m); this.status = status } }
export async function api(path, opts = {}) {
  const u = store.get(), fd = opts.body instanceof FormData, L = MSG[localStorage.getItem('lang')] || MSG.en
  let r
  try { r = await fetch(API + path, { ...opts, headers: { ...(fd ? {} : { 'Content-Type': 'application/json' }), ...(u ? { Authorization: 'Bearer ' + u.token } : {}) }, body: opts.body ? (fd ? opts.body : JSON.stringify(opts.body)) : undefined }) }
  catch { throw new ApiError(L.net, 0) }
  const d = await r.json().catch(() => ({}))
  if (!r.ok) {
    const fallback = r.status === 401 ? L.auth : r.status === 403 ? L.deny : r.status === 404 ? L.nf : r.status >= 500 ? L.srv : 'Something went wrong (' + r.status + '). Please try again.'
    throw new ApiError(d.message && r.status < 500 ? d.message : fallback, r.status)
  }
  return d
}
export async function download(path, filename) {
  const u = store.get(); const r = await fetch(API + path, { headers: u ? { Authorization: 'Bearer ' + u.token } : {} })
  if (!r.ok) throw new ApiError('Could not download the file. Please try again.', r.status)
  const url = URL.createObjectURL(await r.blob()), a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}
export function useLive(cb, topics = ['/topic/orders', '/topic/stock']) {
  useEffect(() => {
    const c = new Client({ webSocketFactory: () => new SockJS(API + '/ws'), reconnectDelay: 3000, onConnect: () => topics.forEach((t) => c.subscribe(t, () => cb())) })
    c.activate(); return () => c.deactivate()
  }, [])
}
/** Calls fn when the user taps/clicks anywhere outside ref's element. */
export function useOutside(ref, fn, on = true) {
  const f = useRef(fn); f.current = fn
  useEffect(() => {
    if (!on) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) f.current() }
    document.addEventListener('mousedown', h); document.addEventListener('touchstart', h)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h) }
  }, [on])
}
