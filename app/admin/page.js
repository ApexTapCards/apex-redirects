'use client'

import { useState, useRef } from 'react'

const DOMAIN = 'go.apextapcards.com'

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

/* ─────────────────────────────────────────────────────────────────────────── */

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
    const v = e.target.value; setQuery(v); setPicked(false)
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
      setPSt(d.status)
      if (d.pitches) setHist(d.pitches)
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

  /* ─── design tokens ────────────────────────────────────────────────────── */
  const bg      = '#07091A'
  const surface = '#0E1124'
  const card    = '#131729'
  const border  = 'rgba(255,255,255,0.07)'
  const gold    = '#C8A840'
  const goldG   = 'linear-gradient(135deg, #DCBE58 0%, #8C6E00 100%)'
  const textPri = '#F2F2FA'
  const textSec = 'rgba(242,242,250,0.45)'
  const textMut = 'rgba(242,242,250,0.28)'

  const inp = {
    display: 'block', width: '100%', height: 52,
    padding: '0 16px',
    background: '#0B0E20',
    border: `1.5px solid rgba(255,255,255,0.09)`,
    borderRadius: 13, fontSize: 16,
    color: textPri, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
    WebkitAppearance: 'none', appearance: 'none',
    transition: 'border-color .15s, box-shadow .15s',
  }

  const pillBase = {
    display: 'flex', alignItems: 'center', gap: 9,
    borderRadius: 12, padding: '12px 15px',
    fontSize: 14, fontWeight: 500,
  }

  /* ─── shared css ───────────────────────────────────────────────────────── */
  const css = `
    * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
    ::placeholder { color: rgba(242,242,250,0.28) !important; }
    input:-webkit-autofill,
    input:-webkit-autofill:focus {
      -webkit-box-shadow: 0 0 0 100px #0B0E20 inset !important;
      -webkit-text-fill-color: #F2F2FA !important;
      caret-color: #F2F2FA;
    }
    .inp:focus {
      border-color: ${gold} !important;
      box-shadow: 0 0 0 3px rgba(200,168,64,.16) !important;
    }
    .drop-row { cursor: pointer; transition: background .1s; }
    .drop-row:hover  { background: rgba(255,255,255,0.05) !important; }
    .drop-row:active { background: rgba(255,255,255,0.08) !important; }
    .btn-gold:active  { opacity: .82; }
    .btn-ghost:active { opacity: .7; }
    select option { background: #131729; color: #F2F2FA; }
  `

  /* ─── sub-components ───────────────────────────────────────────────────── */

  function Tag({ children }) {
    return (
      <div style={{
        display: 'inline-block',
        fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
        textTransform: 'uppercase', color: textMut,
        marginBottom: 9,
      }}>{children}</div>
    )
  }

  function Chip({ color, bg: chipBg, dot, children }) {
    return (
      <div style={{ ...pillBase, background: chipBg, marginBottom: 14 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
        <span style={{ color, fontWeight: 600 }}>{children}</span>
      </div>
    )
  }

  function Panel({ children, style: s = {} }) {
    return (
      <div style={{
        background: card, borderRadius: 16,
        border: `1px solid ${border}`,
        padding: '18px 16px', ...s,
      }}>
        {children}
      </div>
    )
  }

  function GoldBtn({ children, disabled, type = 'button', onClick, style: s = {} }) {
    return (
      <button className="btn-gold" type={type} onClick={onClick} disabled={disabled} style={{
        width: '100%', height: 52, borderRadius: 13, border: 'none',
        background: disabled ? 'rgba(255,255,255,0.07)' : goldG,
        color: disabled ? 'rgba(255,255,255,.25)' : '#fff',
        fontSize: 16, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', letterSpacing: .1,
        boxShadow: disabled ? 'none' : '0 4px 22px rgba(200,168,64,.35)',
        transition: 'opacity .15s', ...s,
      }}>{children}</button>
    )
  }

  function GhostBtn({ children, onClick, disabled }) {
    return (
      <button className="btn-ghost" type="button" onClick={onClick} disabled={disabled} style={{
        width: '100%', height: 50, borderRadius: 13,
        background: 'rgba(255,255,255,0.05)',
        border: `1.5px solid rgba(255,255,255,0.1)`,
        color: disabled ? textMut : 'rgba(242,242,250,0.7)',
        fontSize: 15, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', opacity: disabled ? .4 : 1,
        transition: 'opacity .15s',
      }}>{children}</button>
    )
  }

  /* ══════════════════════════════════════════════════════════════════════════
     LOGIN
  ══════════════════════════════════════════════════════════════════════════ */
  if (!authed) {
    return (
      <div style={{
        minHeight: '100vh', background: bg,
        backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(200,168,64,.22) 0%, transparent 60%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
        WebkitFontSmoothing: 'antialiased',
        padding: '32px 20px',
      }}>
        <style>{css}</style>

        {/* Logo mark */}
        <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: goldG,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 900, color: '#fff',
            boxShadow: '0 8px 28px rgba(200,168,64,.5)',
            letterSpacing: -1,
          }}>A</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: textPri, fontSize: 17, fontWeight: 700, letterSpacing: -.3 }}>Apex Tap Cards</div>
            <div style={{ color: textMut, fontSize: 12, letterSpacing: .8, textTransform: 'uppercase', marginTop: 3 }}>Admin Portal</div>
          </div>
        </div>

        {/* Login card */}
        <div style={{
          width: '100%', maxWidth: 360,
          background: surface,
          borderRadius: 20,
          border: `1px solid ${border}`,
          padding: '28px 22px',
          boxShadow: '0 24px 60px rgba(0,0,0,.6)',
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: textPri, letterSpacing: -.5, marginBottom: 22 }}>
            Sign in
          </div>

          <form onSubmit={login}>
            <Tag>Password</Tag>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <input
                className="inp"
                style={{ ...inp, paddingRight: 62 }}
                type={showPw ? 'text' : 'password'}
                placeholder="Enter your password"
                value={pw}
                onChange={e => setPw(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: 'absolute', right: 0, top: 0, bottom: 0, width: 58,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: textSec, fontSize: 12, fontWeight: 700,
                  fontFamily: 'inherit', letterSpacing: .2,
                }}
              >{showPw ? 'Hide' : 'Show'}</button>
            </div>

            {pwErr && (
              <div style={{
                background: 'rgba(220,38,38,.12)', border: '1px solid rgba(220,38,38,.25)',
                borderRadius: 10, padding: '11px 14px',
                color: '#F87171', fontSize: 13, fontWeight: 500, marginBottom: 14,
              }}>{pwErr}</div>
            )}

            <GoldBtn type="submit">Sign In</GoldBtn>
          </form>
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════════════════════
     SUCCESS
  ══════════════════════════════════════════════════════════════════════════ */
  if (addSt === 'success' && result) {
    return (
      <div style={{
        minHeight: '100vh', background: bg,
        backgroundImage: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(200,168,64,.18) 0%, transparent 60%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
        WebkitFontSmoothing: 'antialiased',
        padding: '32px 20px',
      }}>
        <style>{css}</style>
        <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>

          <div style={{
            width: 76, height: 76, borderRadius: '50%',
            background: goldG,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 34, color: '#fff', margin: '0 auto 22px',
            boxShadow: '0 10px 36px rgba(200,168,64,.5)',
          }}>✓</div>

          <div style={{ fontSize: 24, fontWeight: 800, color: textPri, letterSpacing: -.6, marginBottom: 6 }}>
            {bName} is live!
          </div>
          <div style={{ fontSize: 14, color: textSec, marginBottom: 28, lineHeight: 1.5 }}>
            Program each NFC card with this URL
          </div>

          <div style={{
            background: '#0B0E20', borderRadius: 14,
            padding: '16px', marginBottom: 20,
            fontFamily: "'SF Mono','Fira Mono',monospace",
            fontSize: 13, color: gold, fontWeight: 700,
            wordBreak: 'break-all', lineHeight: 1.6,
            border: `1px solid rgba(200,168,64,.18)`,
          }}>{result.cardUrl}</div>

          <GoldBtn
            onClick={copyUrl}
            style={{
              marginBottom: 10,
              background: copied ? 'linear-gradient(135deg,#22C55E,#15803D)' : goldG,
              boxShadow: copied ? '0 4px 20px rgba(34,197,94,.35)' : '0 4px 22px rgba(200,168,64,.35)',
            }}
          >{copied ? '✓  Copied!' : 'Copy URL'}</GoldBtn>

          <GhostBtn onClick={reset}>Add Another Client</GhostBtn>
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════════════════════
     MAIN FORM
  ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{
      minHeight: '100vh', background: bg,
      backgroundImage: 'radial-gradient(ellipse 70% 35% at 50% 0%, rgba(200,168,64,.14) 0%, transparent 55%)',
      fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
      WebkitFontSmoothing: 'antialiased',
      padding: '0 0 80px',
    }}>
      <style>{css}</style>

      {/* ── top bar ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 20px 16px',
        borderBottom: `1px solid ${border}`,
        background: 'rgba(7,9,26,0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: goldG,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 15, color: '#fff',
            boxShadow: '0 4px 14px rgba(200,168,64,.45)',
          }}>A</div>
          <div>
            <div style={{ color: textPri, fontWeight: 700, fontSize: 14, letterSpacing: -.2, lineHeight: 1.2 }}>
              Apex Tap Cards
            </div>
            <div style={{ color: textMut, fontSize: 10.5, letterSpacing: .7, textTransform: 'uppercase', marginTop: 1 }}>
              Admin Portal
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(200,168,64,.1)', border: '1px solid rgba(200,168,64,.2)',
          borderRadius: 20, padding: '5px 11px',
          color: gold, fontSize: 11, fontWeight: 700, letterSpacing: .8,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: gold, boxShadow: `0 0 8px ${gold}` }} />
          LIVE
        </div>
      </div>

      {/* ── content ─────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 0' }}>

        {/* Search */}
        <Panel style={{ marginBottom: 12 }}>
          <Tag>Search Business</Tag>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-52%)',
              fontSize: 18, lineHeight: 1, pointerEvents: 'none',
              color: picked ? gold : textMut,
              transition: 'color .15s',
            }}>⌕</span>
            <input
              className="inp"
              style={{ ...inp, paddingLeft: 42 }}
              type="text"
              placeholder="Business name..."
              value={query}
              onChange={onQ}
              onFocus={() => { if (sugs.length > 0) setDrop(true) }}
              onBlur={() => { if (!inDrop.current) setDrop(false) }}
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
            />

            {drop && sugs.length > 0 && (
              <div
                onMouseDown={() => { inDrop.current = true }}
                onMouseUp={() => { inDrop.current = false }}
                onTouchStart={() => { inDrop.current = true }}
                onTouchEnd={() => { inDrop.current = false }}
                style={{
                  position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                  background: '#131729',
                  border: `1px solid rgba(255,255,255,0.1)`,
                  borderRadius: 14, zIndex: 999,
                  boxShadow: '0 16px 40px rgba(0,0,0,.6)',
                  overflow: 'hidden',
                }}
              >
                {sugs.map((s, i) => {
                  const p    = s.placePrediction
                  const main = p?.structuredFormat?.mainText?.text || p?.text?.text || ''
                  const sec  = p?.structuredFormat?.secondaryText?.text || ''
                  return (
                    <div key={i} className="drop-row"
                      onMouseDown={e => { e.preventDefault(); pick(s) }}
                      onTouchEnd={e => { e.preventDefault(); pick(s) }}
                      style={{
                        padding: '13px 16px', background: 'transparent',
                        borderBottom: i < sugs.length - 1 ? `1px solid rgba(255,255,255,0.05)` : 'none',
                        minHeight: 54, display: 'flex', flexDirection: 'column', justifyContent: 'center',
                      }}
                    >
                      <div style={{ fontSize: 15, fontWeight: 600, color: textPri, lineHeight: 1.3 }}>{main}</div>
                      {sec && <div style={{ fontSize: 12, color: textSec, marginTop: 2, lineHeight: 1.3 }}>{sec}</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Panel>

        {/* Status */}
        {pSt === 'checking' && (
          <Chip color={textSec} bg="rgba(255,255,255,0.04)" dot="rgba(255,255,255,0.2)">
            Checking visit history...
          </Chip>
        )}
        {pSt === 'new' && (
          <Chip color="#4ADE80" bg="rgba(34,197,94,0.1)" dot="#22C55E">
            New lead — never been visited
          </Chip>
        )}
        {pSt === 'pitched' && (
          <Panel style={{ marginBottom: 12, borderColor: 'rgba(251,191,36,.15)', background: 'rgba(251,191,36,.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: hist.length ? 12 : 0 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#FBBF24', flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#FBBF24' }}>Already visited</span>
            </div>
            {hist.map((h, i) => (
              <div key={i} style={{
                borderTop: '1px solid rgba(251,191,36,.12)',
                paddingTop: 10, marginTop: 10,
                fontSize: 13, color: 'rgba(251,191,36,.7)', lineHeight: 1.7,
              }}>
                <span style={{ fontWeight: 700, color: '#FBBF24' }}>{h.visited_by}</span>
                {' · '}{OUTCOMES[h.outcome] || h.outcome}{' · '}{fmtDate(h.visited_at)}
              </div>
            ))}
          </Panel>
        )}

        {/* Log visit */}
        {picked && (pSt === 'new' || pSt === 'pitched') && logSt !== 'logged' && (
          <Panel style={{ marginBottom: 12 }}>
            <Tag>Log This Visit</Tag>
            <input className="inp" style={{ ...inp, marginBottom: 8 }}
              type="text" placeholder="Your name"
              value={rep} onChange={e => setRep(e.target.value)}
            />
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <select className="inp"
                style={{ ...inp, paddingRight: 36, cursor: 'pointer', color: outcome ? textPri : textMut }}
                value={outcome} onChange={e => setOutcome(e.target.value)}
              >
                <option value="">Select outcome...</option>
                <option value="pitched">Pitched — Awaiting Decision</option>
                <option value="not_interested">Not Interested</option>
                <option value="follow_up">Follow-Up Scheduled</option>
                <option value="sold">Sold ✓</option>
              </select>
              <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: textMut, fontSize: 10 }}>▼</span>
            </div>
            <GhostBtn onClick={logVisit} disabled={!rep.trim() || !outcome || logSt === 'loading'}>
              {logSt === 'loading' ? 'Logging...' : 'Log Visit'}
            </GhostBtn>
            {logSt === 'error' && (
              <div style={{ color: '#F87171', fontSize: 13, marginTop: 8 }}>Failed — try again.</div>
            )}
          </Panel>
        )}

        {logSt === 'logged' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 12, padding: '12px 15px', marginBottom: 12,
            fontSize: 14, color: '#4ADE80', fontWeight: 600,
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: '50%', background: '#22C55E',
              color: '#fff', fontSize: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>✓</span>
            Visit logged
          </div>
        )}

        {/* Add client */}
        {picked && pSt !== 'checking' && (
          <Panel>
            <Tag>Add as Client</Tag>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18,
              fontSize: 15, fontWeight: 600, color: '#4ADE80',
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%', background: '#22C55E',
                color: '#fff', fontSize: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>✓</span>
              {bName}
            </div>

            <Tag>URL Slug</Tag>
            <input className="inp"
              style={{ ...inp, fontFamily: "'SF Mono','Fira Mono',monospace", letterSpacing: .5, marginBottom: 10 }}
              type="text" value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            />

            <div style={{
              background: '#0B0E20', borderRadius: 11,
              padding: '13px 15px', marginBottom: 18,
              fontFamily: "'SF Mono','Fira Mono',monospace",
              fontSize: 13, lineHeight: 1.5, wordBreak: 'break-all',
              border: `1px solid rgba(200,168,64,.12)`,
            }}>
              <span style={{ color: textMut }}>{DOMAIN}/</span>
              <span style={{ color: gold, fontWeight: 700 }}>{slug || '...'}</span>
            </div>

            {addSt === 'error' && (
              <div style={{
                background: 'rgba(220,38,38,.1)', border: '1px solid rgba(220,38,38,.22)',
                borderRadius: 10, padding: '11px 14px',
                color: '#F87171', fontSize: 13, fontWeight: 500, marginBottom: 14,
              }}>{addErr}</div>
            )}

            <GoldBtn type="submit" disabled={!canAdd} onClick={addClient}>
              {addSt === 'loading' ? 'Adding...' : 'Add Client'}
            </GoldBtn>
          </Panel>
        )}

      </div>
    </div>
  )
}
