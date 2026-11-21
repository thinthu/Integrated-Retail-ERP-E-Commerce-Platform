#!/usr/bin/env node
/*
 * Khit Ride - verified product photo downloader (Pixabay).
 *
 * What it does
 *   1. Searches Pixabay with specific queries per product type (photo only, safesearch on, "transportation" category for bikes).
 *   2. Rejects images whose Pixabay tags are wrong (guitars, motorcycles, people, buildings ...).
 *   3. Verifies each picture with a local image-recognition model (CLIP) so "a woman on a bike" or "a guitar" never reaches the shop.
 *   4. Prefers clean product shots (white / neutral background), skips duplicates, retries on HTTP 429.
 *   5. Saves frontend/public/images/<type>-<n>.jpg and rewrites images-manifest.json.
 *   If nothing suitable is found for a type, NOTHING is saved for it and the shop shows a neutral placeholder.
 *
 * Usage (Windows PowerShell, from the tools folder):
 *   npm install                                  (first time only)
 *   $env:PIXABAY_KEY="your-key"
 *   node fetch-photos.mjs --audit                (check the photos you already have, no downloads)
 *   node fetch-photos.mjs --audit --fix          (move wrong photos into images/_old)
 *   node fetch-photos.mjs                        (download verified photos for every type)
 *   node fetch-photos.mjs --only=electric-bike,bicycle-pump --count=4
 * Options: --count=3  --check=30 (max candidates checked per type)  --hd (download larger files)  --keep (do not move old files)  --no-verify (tags only, NOT recommended)  --selftest
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(HERE, '..', 'frontend', 'public', 'images'), OLD = path.join(OUT, '_old'), MANIFEST = path.join(OUT, 'images-manifest.json')
const args = process.argv.slice(2), flag = (n) => args.includes('--' + n), opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const KEY = process.env.PIXABAY_KEY, WANT = Number(opt('count', 3)), MAX_CHECK = Number(opt('check', 30)), ONLY = opt('only', '') ? opt('only', '').split(',').map((s) => s.trim()) : null
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rx = (...w) => new RegExp('\\b(?:' + w.join('|') + ')\\b', 'i')

// ---------- tag rules ----------
const BIKE = rx('bike', 'bikes', 'bicycle', 'bicycles', 'cycle', 'cycles')
const PEOPLE = ['people', 'person', 'woman', 'women', 'man', 'men', 'girl', 'boy', 'couple', 'family', 'rider', 'riders', 'cyclist', 'cyclists', 'biker', 'bikers', 'athlete', 'human', 'portrait', 'model', 'selfie', 'lifestyle', 'tourist', 'tourists', 'wedding', 'crowd', 'peloton']
const OTHER = ['guitar', 'music', 'musical', 'instrument', 'motorcycle', 'motorbike', 'motor', 'scooter', 'moped', 'car', 'cars', 'truck', 'bus', 'train', 'aircraft', 'airplane', 'boat', 'ship', 'building', 'buildings', 'architecture', 'sunset', 'sunrise', 'beach']
const BIKE_REJECT = rx(...PEOPLE, 'child', 'children', 'kid', 'kids', ...OTHER, 'race', 'competition', 'helmet', 'bike path', 'cycle path', 'cycling path', 'bike lane', 'bicycle lane')
const KIDS_REJECT = rx(...PEOPLE, ...OTHER, 'race', 'competition', 'helmet', 'bike path', 'cycle path', 'bike lane')
const GEAR_REJECT = (...extra) => rx(...PEOPLE.filter((w) => !['model'].includes(w)), ...OTHER, ...extra)
const CYC = rx('bicycle', 'bike', 'cycling', 'cycle', 'mtb')

const mk = (key, label, queries, must, labels, o = {}) => ({ key, label, queries, must, labels, cats: o.cats ?? ['transportation', ''], reject: o.reject ?? BIKE_REJECT, neg: o.neg ?? [], kind: o.kind ?? 'bike' })
const T = [
  mk('road-bike', 'Road bike', ['road bike', 'racing bicycle', 'road bicycle white background'], [BIKE, rx('road', 'racing', 'racer', 'roadbike', 'drop handlebar')], ['a road bicycle', 'a racing bike']),
  mk('mountain-bike', 'Mountain bike', ['mountain bike', 'mtb bicycle', 'mountain bike isolated'], [BIKE, rx('mountain bike', 'mountain bikes', 'mtb', 'mountainbike', 'mountain bicycle')], ['a mountain bike']),
  mk('electric-bike', 'Electric bike', ['electric bike', 'e-bike', 'electric bicycle pedelec'], [BIKE, rx('e-bike', 'ebike', 'e bike', 'electric', 'pedelec')], ['an electric bicycle', 'an e-bike']),
  mk('city-bike', 'City bike', ['city bike', 'urban bicycle', 'commuter bike', 'cruiser bicycle'], [BIKE, rx('city', 'urban', 'commuter', 'cruiser', 'dutch', 'town', 'retro', 'vintage', 'classic', 'touring', 'trekking', 'hybrid')], ['a city bicycle', 'a commuter bike']),
  mk('kids-bike', 'Kids bike', ['kids bike', 'children bicycle', 'balance bike', 'kids bicycle isolated'], [BIKE, rx('kid', 'kids', 'child', 'children', 'toddler', 'balance bike', 'training wheels', 'junior')], ['a childrens bicycle', 'a kids bike'], { reject: KIDS_REJECT }),
  mk('bmx-bike', 'BMX bike', ['bmx bike', 'bmx bicycle'], [BIKE, rx('bmx')], ['a BMX bike']),
  mk('folding-bike', 'Folding bike', ['folding bike', 'foldable bicycle', 'folding bicycle'], [BIKE, rx('folding', 'foldable', 'fold', 'brompton', 'collapsible')], ['a folding bicycle']),
  mk('gravel-bike', 'Gravel bike', ['gravel bike', 'cyclocross bike', 'adventure bicycle'], [BIKE, rx('gravel', 'cyclocross', 'cross', 'adventure', 'all-road')], ['a gravel bike', 'a drop-bar bicycle']),
  mk('helmet', 'Bicycle helmet', ['bicycle helmet', 'bike helmet', 'cycling helmet isolated'], [rx('helmet'), CYC], ['a bicycle helmet', 'a cycling helmet'],
    { cats: ['sports', 'transportation', ''], kind: 'gear', reject: GEAR_REJECT('football', 'baseball', 'construction', 'hard hat', 'ski', 'skiing', 'military', 'army', 'soldier', 'viking', 'roman', 'knight', 'armor', 'firefighter', 'hockey', 'climbing', 'rugby', 'american'), neg: ['a motorcycle helmet', 'a construction hard hat', 'a football helmet', 'a ski helmet'] }),
  mk('cycling-gloves', 'Cycling gloves', ['cycling gloves', 'bike gloves', 'bicycle gloves'], [rx('glove', 'gloves'), CYC], ['cycling gloves', 'a pair of gloves'], { cats: ['sports', ''], kind: 'gear', reject: GEAR_REJECT('boxing', 'winter', 'garden', 'kitchen', 'medical', 'rubber', 'latex'), neg: ['boxing gloves', 'garden gloves', 'a winter hat'] }),
  mk('bike-light', 'Bicycle light', ['bicycle light', 'bike light', 'cycling light led'], [rx('light', 'lamp', 'headlight', 'taillight', 'led', 'reflector'), CYC], ['a bicycle light', 'a bike lamp'],
    { cats: ['transportation', 'sports', ''], kind: 'gear', reject: GEAR_REJECT('traffic', 'street light', 'streetlight', 'moon', 'candle', 'christmas', 'lantern', 'bulb', 'stage', 'neon', 'city lights'), neg: ['a street lamp', 'a light bulb', 'a traffic light', 'a candle'] }),
  mk('water-bottle', 'Cycling water bottle', ['bicycle water bottle', 'cycling bottle', 'sports water bottle'], [rx('bottle', 'bottles', 'flask', 'water bottle'), rx('bicycle', 'bike', 'cycling', 'cycle', 'sport', 'sports')], ['a sports water bottle', 'a bicycle bottle'],
    { cats: ['sports', ''], kind: 'gear', reject: GEAR_REJECT('beer', 'wine', 'baby', 'perfume', 'medicine', 'pill', 'plastic waste', 'recycling'), neg: ['a beer bottle', 'a wine bottle', 'a perfume bottle'] }),
  mk('bike-lock', 'Bicycle lock', ['bicycle lock', 'bike lock chain', 'bike u lock'], [rx('lock', 'padlock', 'chain', 'shackle'), CYC], ['a bicycle lock', 'a bike chain lock'],
    { cats: ['transportation', ''], kind: 'gear', reject: GEAR_REJECT('door', 'gate', 'safe', 'vault', 'love lock', 'bridge', 'jail', 'prison'), neg: ['a door lock', 'a padlock on a gate', 'a key'] }),
  mk('bicycle-pump', 'Bicycle pump', ['bicycle pump', 'bike pump', 'bicycle tire pump'], [rx('pump', 'inflator'), rx('bicycle', 'bike', 'cycle', 'cycling', 'tire', 'tyre')], ['a bicycle pump', 'a hand air pump'],
    { cats: ['transportation', 'sports', ''], kind: 'gear', reject: GEAR_REJECT('water', 'gas', 'petrol', 'fuel', 'oil', 'well', 'garden', 'swimming', 'breast', 'heart'), neg: ['a water pump', 'a gas pump', 'a heart'] }),
  mk('bike-bag', 'Bicycle bag', ['bicycle bag', 'bike saddle bag', 'bicycle pannier bag'], [rx('bag', 'bags', 'pannier', 'saddlebag', 'backpack', 'basket'), CYC], ['a bicycle bag', 'a bicycle pannier'],
    { cats: ['transportation', 'sports', ''], kind: 'gear', reject: GEAR_REJECT('handbag', 'shopping', 'fashion', 'luggage', 'suitcase', 'school'), neg: ['a handbag', 'a suitcase', 'a shopping bag'] }),
  mk('bicycle-bell', 'Bicycle bell', ['bicycle bell', 'bike bell', 'cycle bell handlebar'], [rx('bell', 'bells'), CYC], ['a bicycle bell'],
    { cats: ['transportation', ''], kind: 'gear', reject: GEAR_REJECT('church', 'school', 'christmas', 'jingle', 'door', 'cow', 'wedding', 'alarm'), neg: ['a church bell', 'a school bell', 'a christmas bell'] }),
]
const BONUS = rx('isolated', 'white background', 'studio', 'cut out', 'cutout', 'transparent', 'product', 'object', 'single')
const passTags = (h, t) => { const tags = (h.tags || '').toLowerCase(); return (!h.type || h.type === 'photo') && !t.reject.test(tags) && t.must.every((m) => m.test(tags)) }
const MANAGED = new RegExp('^(?:' + [...T.map((t) => t.key), 'cycling-accessories'].join('|') + ')-\\d+\\.(?:jpe?g|png|webp)$', 'i')

// ---------- optional helpers (sharp = pixel checks, CLIP = visual verification) ----------
let sharp = null, RawImage = null
const NEG_ALL = ['a guitar', 'a musical instrument', 'a motorcycle', 'a car', 'a building', 'a city street', 'a landscape', 'a horse', 'an airplane', 'a boat', 'a dog', 'a plate of food', 'a computer']
const PERSON = ['a person', 'a woman riding a bicycle', 'a man riding a bicycle', 'a group of people']
async function loadClip() {
  if (flag('no-verify')) { console.warn('WARNING: --no-verify means only tags are checked. Wrong pictures can still slip through.'); return null }
  let tf; try { tf = await import('@huggingface/transformers') } catch { try { tf = await import('@xenova/transformers') } catch { console.error('Image-recognition package missing. Run "npm install" inside the tools folder (or use --no-verify).'); process.exit(1) } }
  RawImage = tf.RawImage; console.log('Loading image-recognition model (first run downloads about 150 MB)...')
  return tf.pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32')
}
async function verify(clf, buf, t) {
  const labels = [...new Set([...t.labels, ...t.neg, ...NEG_ALL, ...PERSON, ...(t.kind === 'bike' ? [] : ['a bicycle'])])]
  const img = await RawImage.fromBlob(new Blob([buf])), out = await clf(img, labels, { hypothesis_template: 'a photo of {}.' })
  const sc = Object.fromEntries(out.map((o) => [o.label, o.score])), pos = t.labels.reduce((s, l) => s + (sc[l] || 0), 0), personMax = Math.max(...PERSON.map((l) => sc[l] || 0))
  return { ok: t.labels.includes(out[0].label) && pos >= 0.5 && personMax < 0.25, pos: +pos.toFixed(2), top: out[0].label, topScore: +out[0].score.toFixed(2), personMax: +personMax.toFixed(2) }
}
async function bgInfo(buf) {
  if (!sharp) return { white: false }
  const { data } = await sharp(buf).flatten({ background: '#ffffff' }).resize(32, 32, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true }), L = []
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (x < 2 || y < 2 || x > 29 || y > 29) { const i = (y * 32 + x) * 3; L.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) }
  const mean = L.reduce((a, b) => a + b, 0) / L.length, std = Math.sqrt(L.reduce((a, b) => a + (b - mean) ** 2, 0) / L.length)
  return { white: mean > 200 && std < 30 }
}
async function ahash(buf) { if (!sharp) return null; const px = await sharp(buf).flatten({ background: '#ffffff' }).resize(8, 8, { fit: 'fill' }).greyscale().raw().toBuffer(), avg = px.reduce((a, b) => a + b, 0) / px.length; return [...px].map((v) => (v > avg ? 1 : 0)).join('') }
const ham = (a, b) => [...a].reduce((s, c, i) => s + (c !== b[i] ? 1 : 0), 0)

// ---------- HTTP with rate-limit handling ----------
let last = 0
async function http(url, json) {
  for (let attempt = 0; attempt < 7; attempt++) {
    const wait = 900 - (Date.now() - last); if (wait > 0) await sleep(wait); last = Date.now()
    const r = await fetch(url, { headers: { 'User-Agent': 'khit-ride-photo-tool' } })
    const remaining = Number(r.headers.get('x-ratelimit-remaining')), reset = Number(r.headers.get('x-ratelimit-reset'))
    if (r.status === 429) { const s = Number(r.headers.get('retry-after')) || reset || 15 * 2 ** Math.min(attempt, 3); console.log(`   HTTP 429 (rate limit) - waiting ${s + 1}s, retry ${attempt + 1}/7`); await sleep((s + 1) * 1000); continue }
    if (!r.ok) throw new Error('HTTP ' + r.status)
    if (!Number.isNaN(remaining) && remaining <= 2 && reset) await sleep((reset + 1) * 1000)
    return json ? r.json() : Buffer.from(await r.arrayBuffer())
  }
  throw new Error('still rate limited after 7 tries')
}
async function search(q, cat, colors) {
  const p = new URLSearchParams({ key: KEY, q, lang: 'en', image_type: 'photo', orientation: 'horizontal', safesearch: 'true', min_width: '600', order: 'popular', per_page: '50' })
  if (cat) p.set('category', cat); if (colors) p.set('colors', colors)
  return (await http('https://pixabay.com/api/?' + p, true)).hits || []
}

// ---------- manifest / files ----------
const readManifest = () => { try { const j = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); return Array.isArray(j.items) ? j : { items: [] } } catch { return { items: [] } } }
const writeManifest = (items, missing) => fs.writeFileSync(MANIFEST, JSON.stringify({ generatedAt: new Date().toISOString(), source: 'Pixabay', license: 'Pixabay Content License - do not redistribute the images as standalone files', items, missing }, null, 2))
const moveOld = (f) => { fs.mkdirSync(OLD, { recursive: true }); fs.renameSync(path.join(OUT, f), path.join(OLD, Date.now() + '-' + f)) }

async function collect(t, clf, state) {
  const got = []; let checked = 0
  console.log(`\n== ${t.label} (${t.key}) ==`)
  outer: for (const colors of ['white,gray,transparent', '']) for (const cat of t.cats) for (const q of t.queries) {
    if (got.length >= WANT || checked >= MAX_CHECK) break outer
    let hits = []; try { hits = await search(q, cat, colors) } catch (e) { console.warn(`   search "${q}" failed: ${e.message}`); continue }
    hits = hits.filter((h) => !state.seen.has(h.id) && passTags(h, t)).sort((a, b) => (BONUS.test(b.tags) ? 1 : 0) - (BONUS.test(a.tags) ? 1 : 0) || b.likes + b.downloads - (a.likes + a.downloads))
    for (const h of hits) {
      if (got.length >= WANT || checked >= MAX_CHECK) break
      state.seen.add(h.id); checked++
      let buf; try { buf = await http(flag('hd') ? h.largeImageURL : h.webformatURL) } catch (e) { console.warn(`   download failed (${h.id}): ${e.message}`); continue }
      const hash = await ahash(buf); if (hash && state.hashes.some((x) => ham(x, hash) <= 5)) { console.log(`   - ${h.id} duplicate of another photo`); continue }
      let v = null; if (clf) { v = await verify(clf, buf, t); if (!v.ok) { console.log(`   x ${h.id} rejected by image check: looks like "${v.top}" (${v.topScore}), match ${v.pos}, person ${v.personMax}  [${h.tags}]`); continue } }
      const bg = await bgInfo(buf); if (hash) state.hashes.push(hash)
      const ext = (new URL(h.webformatURL).pathname.match(/\.(jpe?g|png|webp)$/i) || [, 'jpg'])[1].toLowerCase(), file = `${t.key}-${got.length + 1}.${ext}`
      fs.writeFileSync(path.join(OUT, file), buf)
      got.push({ file, key: t.key, label: t.label, pixabayId: h.id, photographer: h.user, pageUrl: h.pageURL, tags: h.tags, whiteBackground: bg.white, check: v ? { top: v.top, match: v.pos } : null })
      console.log(`   OK ${file}  (id ${h.id}${bg.white ? ', clean background' : ''}${v ? ', match ' + v.pos : ''})`)
    }
  }
  if (got.length < WANT) console.warn(`   Only ${got.length}/${WANT} suitable photos found for ${t.key}. The shop will show a neutral placeholder where none exists.`)
  return got
}

async function audit(clf) {
  if (!clf) { console.error('--audit needs the image-recognition model (remove --no-verify).'); process.exit(1) }
  const man = readManifest(), files = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter((f) => MANAGED.test(f)) : [], bad = []
  console.log(`Checking ${files.length} photo(s) in ${OUT}\n`)
  for (const f of files) {
    const key = f.replace(/-\d+\.\w+$/, ''), t = T.find((x) => x.key === key)
    if (!t) { console.log(`BAD  ${f}  (no longer used - generic accessory photos are not allowed)`); bad.push(f); continue }
    const buf = fs.readFileSync(path.join(OUT, f)), v = await verify(clf, buf, t), it = man.items.find((i) => i.file === f)
    const tagBad = it && it.tags && !passTags({ tags: it.tags, type: 'photo' }, t)
    if (v.ok && !tagBad) console.log(`OK   ${f}  (match ${v.pos})`); else { console.log(`BAD  ${f}  looks like "${v.top}" (${v.topScore}), match ${v.pos}, person ${v.personMax}${tagBad ? ', tags do not fit' : ''}`); bad.push(f) }
  }
  if (flag('fix') && bad.length) { bad.forEach(moveOld); writeManifest(man.items.filter((i) => !bad.includes(i.file)), []); console.log(`\nMoved ${bad.length} wrong photo(s) to images/_old. Run "node fetch-photos.mjs" to fetch verified replacements.`) }
  else if (bad.length) console.log(`\n${bad.length} wrong photo(s). Re-run with --fix to move them away.`)
}

function selftest() {
  const t = (k) => T.find((x) => x.key === k), h = (tags) => ({ tags, type: 'photo' })
  assert(passTags(h('electric bike, ebike, bicycle, isolated'), t('electric-bike')))
  assert(!passTags(h('guitar, music, fender, bicycle'), t('electric-bike')))
  assert(!passTags(h('woman, bike, electric bike, city'), t('electric-bike')))
  assert(!passTags(h('motorcycle, bike, electric'), t('electric-bike')))
  assert(passTags(h('bicycle helmet, cycling, safety'), t('helmet')) && !passTags(h('motorcycle helmet, bike'), t('helmet')) && !passTags(h('helmet, construction'), t('helmet')))
  assert(passTags(h('bicycle pump, tire, bike'), t('bicycle-pump')) && !passTags(h('water pump, bike'), t('bicycle-pump')))
  assert(passTags(h('mountain bike, bicycle, mtb'), t('mountain-bike')) && !passTags(h('mountain, landscape, hiking'), t('mountain-bike')))
  assert(passTags(h('kids bike, bicycle, child'), t('kids-bike')) && !passTags(h('kids bike, boy, riding, bicycle'), t('kids-bike')))
  assert(passTags(h('bicycle light, led, cycling'), t('bike-light')) && !passTags(h('street light, bicycle'), t('bike-light')))
  assert(!passTags({ tags: 'electric bike, bicycle', type: 'illustration' }, t('electric-bike')))
  console.log('selftest passed (' + T.length + ' product types configured)')
}

async function main() {
  if (flag('selftest')) return selftest()
  fs.mkdirSync(OUT, { recursive: true }); try { sharp = (await import('sharp')).default } catch { console.warn('Note: "sharp" not found - background and duplicate checks are skipped.') }
  const clf = await loadClip()
  if (flag('audit')) return audit(clf)
  if (!KEY) { console.error('Set your key first:  $env:PIXABAY_KEY="your-key"'); process.exit(1) }
  const targets = ONLY ? T.filter((t) => ONLY.includes(t.key)) : T; if (!targets.length) { console.error('No matching type in --only. Valid: ' + T.map((t) => t.key).join(', ')); process.exit(1) }
  const man = readManifest(), keepItems = man.items.filter((i) => !targets.some((t) => t.key === i.key) && fs.existsSync(path.join(OUT, i.file)))
  if (!flag('keep')) { for (const f of fs.readdirSync(OUT).filter((f) => MANAGED.test(f))) { const key = f.replace(/-\d+\.\w+$/, ''); if (!ONLY || ONLY.includes(key) || !T.some((t) => t.key === key)) { if (!keepItems.some((i) => i.file === f)) moveOld(f) } } }
  const state = { seen: new Set(keepItems.map((i) => i.pixabayId)), hashes: [] }
  for (const i of keepItems) { const hsh = await ahash(fs.readFileSync(path.join(OUT, i.file))); if (hsh) state.hashes.push(hsh) }
  let items = [...keepItems]; const missing = []
  for (const t of targets) { const got = await collect(t, clf, state); items = [...items, ...got]; if (got.length === 0) missing.push(t.key); writeManifest(items, missing) }
  writeManifest(items, missing)
  console.log(`\nDone. ${items.length} verified photo(s) saved. Manifest: ${MANIFEST}`)
  if (missing.length) console.log('No suitable photo found for: ' + missing.join(', ') + '  (placeholders will be used; try again later or upload photos in the back office)')
  console.log('Pixabay Content License: review before publishing; do not redistribute the images as standalone files.')
}
main().catch((e) => { console.error(e); process.exit(1) })
