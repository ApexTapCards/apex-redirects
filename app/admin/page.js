'use client'

import { useState, useRef } from 'react'

const DOMAIN = 'go.apextapcards.com'
const NAVY   = '#162040'
const GOLD   = '#B8962E'
const GOLD_G = 'linear-gradient(135deg, #D4AA40 0%, #906E00 100%)'

const OUTCOMES = {
  pitched:        'Pitched — Awaiting Decision',
  not_interested: 'Not Interested',
  follow_up:      'Follow-Up Scheduled',
  sold:           'Sold ✓',
}

function toSlug(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
}
function extractCity(full, name) {
  let t = full || ''
  if (name && t.toLowerCase().startsWith(name.toLowerCase()))
    t = t.slice(name.length).replace(/^[,\s]+/, '')
  const parts = t.split(',').map(p => p.trim()).filter(Boolean)
  const pi = parts.findIndex(p => /^[A-Z]{2}(\s|$)/.test(p))
  const lim = pi > 0 ? pi : parts.length
  for (let i = 0; i < lim; i++) if (parts[i] && !/^\d/.test(parts[i])) return parts[i]
  return ''
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Inline SVG approximation of the Apex Tap Cards logo
function Logo({ height = 38 }) {
  const w = height * 4.2
  return (
    <svg width={w} height={height} viewBox="0 0 420 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Mountain silhouette */}
      <path d="M8 88 L62 12 L88 46 L114 12 L168 88 Z" fill={NAVY} />
      <path d="M30 88 L62 36 L88 62 L114 36 L146 88 Z" fill="white" />
      {/* NFC waves */}
      <path d="M128 42 C 138 32 138 22 128 12" stroke={GOLD} strokeWidth="5.5" fill="none" strokeLinecap="round"/>
      <path d="M138 48 C 153 32 153 18 138 2"  stroke={GOLD} strokeWidth="5.5" fill="none" strokeLinecap="round"/>
      <path d="M148 54 C 168 32 168 14 148 -8" stroke={GOLD} strokeWidth="5.5" fill="none" strokeLinecap="round"/>
      {/* Text */}
      <text x="192" y="52" fontFamily="-apple-system,BlinkMacSystemFont,'Inter',sans-serif" fontWeight="800" fontSize="44" fill={NAVY} letterSpacing="-1">Apex</text>
      <text x="192" y="92" fontFamily="-apple-system,BlinkMacSystemFont,'Inter',sans-serif" fontWeight="800" fontSize="38" fill={NAVY} letterSpacing="-0.5">Tap Cards</text>
    </svg>
  )
}

export default function AdminPage() {
  const [authed, setAuthed]   = useState(false)
  const [pw, setPw]           = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [pwErr, setPwErr]     = useState('')

  const [query, setQuery]     = useState('')
  const [sugs, setSugs]       = useState([])
  const [drop, setDrop]       = useState(false)
  const [picked, setPicked]   = useState(false)

  const [bName, setBName]     = useState('')
  const [gUrl, setGUrl]       = useState('')
  const [pid, setPid]         = useState('')
  const [slug, setSlug]       = useState('')

  const [pSt, setPSt]         = useState(null)
  const [hist, setHist]       = useState([])
  const [rep, setRep]         = useState('')
  const [outcome, setOutcome] = useState('')
  const [logSt, setLogSt]     = useState(null)

  const [addSt, setAddSt]     = useState(null)
  const [addErr, setAddErr]   = useState('')
  const [result, setResult]   = useState(null)
  const [copied, setCopied]   = useState(false)

  const dbc    = useRef(null)
  const inDrop = useRef(false)

  async function fetchSugs(v) {
    if (v.length < 2) { setSugs([]); setDrop(false); return }
    try {
      const r = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY },
        body: JSON.stringify({ input: v, includedPrimaryTypes: ['establishment'] }),
      })
      const d = await r.json()
      const list = d.suggestions || []
      setSugs(list); setDrop(list.length > 0)
    } catch {}
  }

  function onQ(e) {
    const v = e.target.value
    setQuery(v); setPicked(false)
    setBName(''); setGUrl(''); setPid(''); setSlug('')
    setPSt(null); setHist([]); setLogSt(null)
    setAddSt(null); setAddErr('')
    clearTimeout(dbc.current)
    dbc.current = setTimeout(() => fetchSugs(v), 300)
  }

  function pick(sug) {
    const pred = sug.placePrediction
    const n    = pred?.structuredFormat?.mainText?.text || pred?.text?.text || ''
    const id   = pred?.placeId || ''
    const full = pred?.text?.text || ''
    const city = extractCity(full, n)
    const auto = city ? toSlug(n) + '-' + toSlug(city) : toSlug(n)
    setBName(n); setGUrl(`https://search.google.com/local/writereview?placeid=${id}`)
    setPid(id); setSlug(auto); setQuery(n); setPicked(true)
    setSugs([]); setDrop(false)
    setHist([]); setLogSt(null); setOutcome(''); setAddSt(null); setAddErr('')
    checkPitch(id)
  }

  async function checkPitch(id) {
    setPSt('checking')
    try {
      const r = await fetch(`/api/check-pitch?placeId=${encodeURIComponent(id)}`)
      const d = await r.json()
      setPSt(d.status); if (d.pitches) setHist(d.pitches)
    } catch { setPSt('new') }
  }

  async function logVisit() {
    if (!rep.trim() || !outcome) return
    setLogSt('loading')
    try {
      const r = await fetch('/api/log-pitch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place_id: pid, business_name: bName, visited_by: rep.trim(), outcome, password: pw }),
      })
      if (r.ok) {
        setLogSt('logged')
        setHist(prev => [{ visited_by: rep.trim(), outcome, visited_at: new Date().toISOString() }, ...prev])
        if (pSt === 'new') setPSt('pitched')
      } else setLogSt('error')
    } catch { setLogSt('error') }
  }

  async function login(e) {
    e.preventDefault()
    const r = await fetch('/api/admin-auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    })
    if (r.ok) { setAuthed(true); setPwErr('') } else setPwErr('Incorrect password.')
  }

  async function addClient(e) {
    e.preventDefault()
    if (!bName || !gUrl || !slug) return
    setAddSt('loading'); setAddErr('')
    const r = await fetch('/api/add-client', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, client_name: bName, google_url: gUrl, password: pw }),
    })
    const d = await r.json()
    if (r.ok) { setAddSt('success'); setResult({ slug, cardUrl: `https://${DOMAIN}/${slug}` }) }
    else { setAddSt('error'); setAddErr(d.error || 'Something went wrong.') }
  }

  async function copyUrl() {
    if (!result) return
    await navigator.clipboard.writeText(result.cardUrl)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  function reset() {
    setAddSt(null); setResult(null); setAddErr(''); setCopied(false)
    setPicked(false); setQuery(''); setBName(''); setGUrl(''); setPid(''); setSlug('')
    setPSt(null); setHist([]); setLogSt(null); setRep(''); setOutcome('')
  }

  const canAdd = picked && slug.trim() && pSt !== 'checking' && addSt !== 'loading'

  const inp = {
    display: 'block', width: '100%', height: 52, padding: '0 16px',
    background: '#F2F5FB', border: '1.5px solid #DDE3F0',
    borderRadius: 12, fontSize: 16, color: NAVY,
    fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', WebkitAppearance: 'none', appearance: 'none',
  }

  const css = `
    *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body { margin: 0; }
    .inp::placeholder { color: #A0AABF; }
    .inp:focus { border-color: ${GOLD} !important; background: #fff !important; box-shadow: 0 0 0 3px rgba(184,150,46,.14) !important; outline: none; }
    input:-webkit-autofill { -webkit-box-shadow: 0 0 0 100px #F2F5FB inset !important; -webkit-text-fill-color: ${NAVY} !important; }
    .dr:hover { background: #F5F7FC !important; }
    .dr:active { background: #EEF1FA !important; }
    .gbtn:active { background: #E8EDF8 !important; }
    select.inp option { background: #fff; color: ${NAVY}; }
  `

  const Card = ({ children, style: s = {} }) => (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E4E9F4', padding: '20px 18px', boxShadow: '0 2px 12px rgba(22,32,64,.07)', ...s }}>
      {children}
    </div>
  )

  const Label = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#8892AA', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>{children}</div>
  )

  const GoldBtn = ({ children, disabled, type = 'button', onClick, style: s = {} }) => (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      width: '100%', height: 52, borderRadius: 13, border: 'none',
      background: disabled ? '#E8EBF4' : GOLD_G,
      color: disabled ? '#A0AABF' : '#fff',
      fontSize: 16, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'inherit', boxShadow: disabled ? 'none' : '0 4px 18px rgba(184,150,46,.32)',
      ...s,
    }}>{children}</button>
  )

  const OutlineBtn = ({ children, onClick, disabled }) => (
    <button className="gbtn" type="button" onClick={onClick} disabled={disabled} style={{
      width: '100%', height: 50, borderRadius: 13,
      background: '#F2F5FB', border: '1.5px solid #DDE3F0',
      color: disabled ? '#A0AABF' : NAVY,
      fontSize: 15, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'inherit', opacity: disabled ? .45 : 1,
    }}>{children}</button>
  )

  const pageBg = {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #EDF0FA 0%, #F5F7FF 60%, #EBF0FA 100%)',
    fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
    WebkitFontSmoothing: 'antialiased',
  }

  /* ── LOGIN ─────────────────────────────────────────────────────────────── */
  if (!authed) return (
    <div style={{ ...pageBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
      <style>{css}</style>
      <div style={{ marginBottom: 28 }}><Logo height={46} /></div>
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 20, border: '1px solid #E0E6F4', padding: '30px 24px 26px', boxShadow: '0 8px 40px rgba(22,32,64,.1)' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: NAVY, letterSpacing: -.5, marginBottom: 4 }}>Admin sign in</div>
        <div style={{ fontSize: 14, color: '#8892AA', marginBottom: 24 }}>Access the Apex Tap Cards portal</div>
        <form onSubmit={login} noValidate>
          <Label>Password</Label>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <input className="inp" style={{ ...inp, paddingRight: 60 }} type={showPw ? 'text' : 'password'} placeholder="Enter your password" value={pw} onChange={e => setPw(e.target.value)} autoFocus />
            <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 56, background: 'none', border: 'none', cursor: 'pointer', color: '#8892AA', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
          {pwErr && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '11px 14px', color: '#B91C1C', fontSize: 14, fontWeight: 500, marginBottom: 14 }}>{pwErr}</div>}
          <GoldBtn type="submit">Sign In</GoldBtn>
        </form>
      </div>
    </div>
  )

  /* ── SUCCESS ───────────────────────────────────────────────────────────── */
  if (addSt === 'success' && result) return (
    <div style={{ ...pageBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
      <style>{css}</style>
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 20, border: '1px solid #E0E6F4', padding: '32px 24px', boxShadow: '0 8px 40px rgba(22,32,64,.1)', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: GOLD_G, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#fff', margin: '0 auto 20px', boxShadow: '0 8px 28px rgba(184,150,46,.38)' }}>✓</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: NAVY, letterSpacing: -.5, marginBottom: 6 }}>{bName} is live!</div>
        <div style={{ fontSize: 14, color: '#8892AA', marginBottom: 22 }}>Program each NFC card with this URL</div>
        <div style={{ background: NAVY, borderRadius: 12, padding: '14px 16px', marginBottom: 20, fontFamily: 'monospace', fontSize: 13, color: GOLD, fontWeight: 700, wordBreak: 'break-all', lineHeight: 1.6, border: `1px solid rgba(184,150,46,.2)` }}>{result.cardUrl}</div>
        <GoldBtn onClick={copyUrl} style={{ marginBottom: 10, background: copied ? 'linear-gradient(135deg,#22C55E,#15803D)' : GOLD_G, boxShadow: copied ? '0 4px 18px rgba(34,197,94,.32)' : '0 4px 18px rgba(184,150,46,.32)' }}>
          {copied ? '✓  Copied!' : 'Copy URL'}
        </GoldBtn>
        <OutlineBtn onClick={reset}>Add Another Client</OutlineBtn>
      </div>
    </div>
  )

  /* ── MAIN FORM ─────────────────────────────────────────────────────────── */
  return (
    <div style={{ ...pageBg, paddingBottom: 60 }}>
      <style>{css}</style>

      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E4E9F4', padding: '12px 20px', position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 8px rgba(22,32,64,.06)' }}>
        <Logo height={32} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(184,150,46,.08)', border: '1px solid rgba(184,150,46,.22)', borderRadius: 20, padding: '5px 11px', color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: .8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD, boxShadow: `0 0 6px ${GOLD}` }} />
          LIVE
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 0' }}>

        {/* Search */}
        <Card style={{ marginBottom: 12 }}>
          <Label>Search Business</Label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-52%)', fontSize: 18, lineHeight: 1, pointerEvents: 'none', color: picked ? GOLD : '#C0C8DA', transition: 'color .15s' }}>⌕</span>
            <input className="inp" style={{ ...inp, paddingLeft: 42 }} type="text" placeholder="Business name..." value={query} onChange={onQ}
              onFocus={() => { if (sugs.length > 0) setDrop(true) }}
              onBlur={() => { if (!inDrop.current) setDrop(false) }}
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
            />
            {drop && sugs.length > 0 && (
              <div onMouseDown={() => { inDrop.current = true }} onMouseUp={() => { inDrop.current = false }} onTouchStart={() => { inDrop.current = true }} onTouchEnd={() => { inDrop.current = false }}
                style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', borderRadius: 14, zIndex: 999, border: '1px solid #E4E9F4', boxShadow: '0 12px 36px rgba(22,32,64,.14)', overflow: 'hidden' }}>
                {sugs.map((s, i) => {
                  const p = s.placePrediction
                  const main = p?.structuredFormat?.mainText?.text || p?.text?.text || ''
                  const sec  = p?.structuredFormat?.secondaryText?.text || ''
                  return (
                    <div key={i} className="dr" onMouseDown={e => { e.preventDefault(); pick(s) }} onTouchEnd={e => { e.preventDefault(); pick(s) }}
                      style={{ padding: '13px 16px', background: '#fff', borderBottom: i < sugs.length - 1 ? '1px solid #F0F3FA' : 'none', minHeight: 54, display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer' }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: NAVY, lineHeight: 1.3 }}>{main}</div>
                      {sec && <div style={{ fontSize: 12, color: '#8892AA', marginTop: 2, lineHeight: 1.3 }}>{sec}</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Status */}
        {pSt === 'checking' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#fff', border: '1px solid #E4E9F4', borderRadius: 12, padding: '12px 16px', marginBottom: 12, fontSize: 14, color: '#8892AA' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#C8D0E4', flexShrink: 0 }} /> Checking status...
          </div>
        )}
        {pSt === 'new' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '12px 16px', marginBottom: 12, fontSize: 14, color: '#166534', fontWeight: 600 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} /> New lead — never been visited
          </div>
        )}
        {pSt === 'pitched' && (
          <Card style={{ marginBottom: 12, borderColor: '#FDE68A', background: '#FFFDF0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, color: '#92400E', fontWeight: 700, marginBottom: hist.length ? 10 : 0 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} /> Already visited
            </div>
            {hist.map((h, i) => (
              <div key={i} style={{ borderTop: '1px solid #FDE68A', paddingTop: 9, marginTop: 9, fontSize: 13, color: '#78350F', lineHeight: 1.7 }}>
                <span style={{ fontWeight: 700 }}>{h.visited_by}</span>{' · '}{OUTCOMES[h.outcome] || h.outcome}{' · '}<span style={{ color: '#A16207' }}>{fmtDate(h.visited_at)}</span>
              </div>
            ))}
          </Card>
        )}

        {/* Log visit */}
        {picked && (pSt === 'new' || pSt === 'pitched') && logSt !== 'logged' && (
          <Card style={{ marginBottom: 12 }}>
            <Label>Log This Visit</Label>
            <input className="inp" style={{ ...inp, marginBottom: 8 }} type="text" placeholder="Your name" value={rep} onChange={e => setRep(e.target.value)} />
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <select className="inp" style={{ ...inp, paddingRight: 36, cursor: 'pointer', color: outcome ? NAVY : '#A0AABF' }} value={outcome} onChange={e => setOutcome(e.target.value)}>
                <option value="">Select outcome...</option>
                <option value="pitched">Pitched — Awaiting Decision</option>
                <option value="not_interested">Not Interested</option>
                <option value="follow_up">Follow-Up Scheduled</option>
                <option value="sold">Sold ✓</option>
              </select>
              <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#A0AABF', fontSize: 10 }}>▼</span>
            </div>
            <OutlineBtn onClick={logVisit} disabled={!rep.trim() || !outcome || logSt === 'loading'}>
              {logSt === 'loading' ? 'Logging...' : 'Log Visit'}
            </OutlineBtn>
            {logSt === 'error' && <div style={{ color: '#DC2626', fontSize: 13, marginTop: 8 }}>Failed — try again.</div>}
          </Card>
        )}
        {logSt === 'logged' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '12px 16px', marginBottom: 12, fontSize: 14, color: '#166534', fontWeight: 600 }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#22C55E', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✓</span>
            Visit logged
          </div>
        )}

        {/* Add client */}
        {picked && pSt !== 'checking' && (
          <Card>
            <Label>Add as Client</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontSize: 15, fontWeight: 600, color: '#166534' }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#22C55E', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✓</span>
              {bName}
            </div>
            <Label>URL Slug</Label>
            <input className="inp" style={{ ...inp, fontFamily: 'monospace', letterSpacing: .4, marginBottom: 10 }} type="text" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
            <div style={{ background: NAVY, borderRadius: 11, padding: '13px 15px', marginBottom: 18, fontFamily: 'monospace', fontSize: 13, lineHeight: 1.5, wordBreak: 'break-all', border: `1px solid rgba(184,150,46,.15)` }}>
              <span style={{ color: 'rgba(255,255,255,.3)' }}>{DOMAIN}/</span>
              <span style={{ color: GOLD, fontWeight: 700 }}>{slug || '...'}</span>
            </div>
            {addSt === 'error' && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '11px 14px', color: '#B91C1C', fontSize: 14, fontWeight: 500, marginBottom: 14 }}>{addErr}</div>}
            <GoldBtn type="submit" disabled={!canAdd} onClick={addClient}>
              {addSt === 'loading' ? 'Adding...' : 'Add Client'}
            </GoldBtn>
          </Card>
        )}

      </div>
    </div>
  )
}
