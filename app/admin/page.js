'use client'

import { useState, useRef } from 'react'

const DOMAIN = 'go.apextapcards.com'
const GOLD   = '#C4A535'
const NAVY   = '#090C18'

const OUTCOMES = {
  pitched:       'Pitched — Awaiting Decision',
  not_interested:'Not Interested',
  follow_up:     'Follow-Up Scheduled',
  sold:          'Sold',
}

function toSlug(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-')
}

function extractCity(full, name) {
  let t = full || ''
  if (name && t.toLowerCase().startsWith(name.toLowerCase()))
    t = t.slice(name.length).replace(/^[,\s]+/,'')
  const parts = t.split(',').map(p => p.trim()).filter(Boolean)
  const pi = parts.findIndex(p => /^[A-Z]{2}(\s|$)/.test(p))
  const lim = pi > 0 ? pi : parts.length
  for (let i = 0; i < lim; i++) if (parts[i] && !/^\d/.test(parts[i])) return parts[i]
  return ''
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

/* ─── base styles ─────────────────────────────────────────────────────────── */

const baseInput = {
  display: 'block', width: '100%', height: 50, padding: '0 14px',
  borderRadius: 11, border: '1.5px solid #E4E4EE',
  fontSize: 16, color: '#0A0D1A', background: '#F8F8FC',
  boxSizing: 'border-box', fontFamily: 'inherit',
  outline: 'none', WebkitAppearance: 'none', appearance: 'none',
  transition: 'border-color .15s, box-shadow .15s, background .15s',
}

/* ─── component helpers ───────────────────────────────────────────────────── */

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: '#A0A0B4',
      textTransform: 'uppercase', letterSpacing: '1.1px', marginBottom: 10,
    }}>
      {children}
    </div>
  )
}

function Divider() {
  return <div style={{ borderTop: '1px solid #EEEEF5', margin: '20px 0' }} />
}

function PrimaryBtn({ children, disabled, type = 'button', onClick, style: s = {} }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      display: 'block', width: '100%', height: 50, borderRadius: 12, border: 'none',
      background: disabled
        ? '#EBEBF2'
        : 'linear-gradient(135deg, #D4AA40 0%, #8C6E00 100%)',
      color: disabled ? '#B0B0C0' : '#fff',
      fontSize: 16, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
      letterSpacing: 0.1, fontFamily: 'inherit',
      boxShadow: disabled ? 'none' : '0 4px 18px rgba(196,165,53,.38)',
      transition: 'opacity .15s, box-shadow .15s',
      ...s,
    }}>
      {children}
    </button>
  )
}

function GhostBtn({ children, onClick, disabled, style: s = {} }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      display: 'block', width: '100%', height: 48, borderRadius: 12,
      border: '1.5px solid #DDDDE8', background: '#fff',
      color: disabled ? '#C0C0CC' : '#4A4A5A',
      fontSize: 15, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1, fontFamily: 'inherit',
      transition: 'opacity .15s',
      ...s,
    }}>
      {children}
    </button>
  )
}

/* ─── page ────────────────────────────────────────────────────────────────── */

export default function AdminPage() {
  const [authed, setAuthed]     = useState(false)
  const [pw, setPw]             = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [pwErr, setPwErr]       = useState('')

  const [query, setQuery]       = useState('')
  const [sugs, setSugs]         = useState([])
  const [drop, setDrop]         = useState(false)
  const [picked, setPicked]     = useState(false)

  const [bName, setBName]       = useState('')
  const [gUrl, setGUrl]         = useState('')
  const [pid, setPid]           = useState('')
  const [slug, setSlug]         = useState('')

  const [pSt, setPSt]           = useState(null)
  const [hist, setHist]         = useState([])
  const [rep, setRep]           = useState('')
  const [outcome, setOutcome]   = useState('')
  const [logSt, setLogSt]       = useState(null)

  const [addSt, setAddSt]       = useState(null)
  const [addErr, setAddErr]     = useState('')
  const [result, setResult]     = useState(null)
  const [copied, setCopied]     = useState(false)

  const dbc    = useRef(null)
  const inDrop = useRef(false)

  /* handlers */
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
    if (r.ok) { setAuthed(true); setPwErr('') } else setPwErr('Incorrect password — try again.')
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
    setCopied(true); setTimeout(() => setCopied(false), 2200)
  }

  function reset() {
    setAddSt(null); setResult(null); setAddErr(''); setCopied(false)
    setPicked(false); setQuery(''); setBName(''); setGUrl(''); setPid(''); setSlug('')
    setPSt(null); setHist([]); setLogSt(null); setRep(''); setOutcome('')
  }

  const canAdd = picked && slug.trim() && pSt !== 'checking' && addSt !== 'loading'

  /* ── page shell ──────────────────────────────────────────────────────── */
  return (
    <div style={{
      minHeight: '100vh',
      background: NAVY,
      backgroundImage: [
        'radial-gradient(ellipse 90% 40% at 50% -5%, rgba(196,165,53,.2) 0%, transparent 65%)',
        'radial-gradient(ellipse 50% 30% at 0% 100%, rgba(20,30,70,.8) 0%, transparent 60%)',
      ].join(','),
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '28px 16px 72px',
    }}>

      <style>{`
        .fi:focus {
          border-color: ${GOLD} !important;
          background: #fff !important;
          box-shadow: 0 0 0 3px rgba(196,165,53,.13) !important;
        }
        .dr-row { cursor: pointer; transition: background .1s; }
        .dr-row:hover, .dr-row:active { background: #F6F6FA !important; }
        .pbtn:not(:disabled):active { opacity: .82; transform: scale(.99); }
        .gbtn:not(:disabled):active { background: #F4F4F8 !important; }
      `}</style>

      {/* brand row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', maxWidth: 390, marginBottom: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(145deg, #D4AA40, #8C6E00)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 16, color: '#fff',
            boxShadow: '0 4px 14px rgba(196,165,53,.5)',
          }}>A</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, letterSpacing: -.2, lineHeight: 1.2 }}>
              Apex Tap Cards
            </div>
            <div style={{ color: 'rgba(255,255,255,.32)', fontSize: 11, letterSpacing: .6, textTransform: 'uppercase', marginTop: 1 }}>
              Admin
            </div>
          </div>
        </div>
        {authed && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(196,165,53,.1)', border: '1px solid rgba(196,165,53,.22)',
            borderRadius: 20, padding: '5px 11px',
            color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: .8,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: GOLD,
              boxShadow: `0 0 7px ${GOLD}`,
            }} />
            LIVE
          </div>
        )}
      </div>

      {/* card */}
      <div style={{
        width: '100%', maxWidth: 390,
        background: '#fff',
        borderRadius: 20,
        padding: '28px 22px 26px',
        boxShadow: '0 24px 64px rgba(0,0,0,.55), 0 1px 0 rgba(255,255,255,.06)',
      }}>

        {/* ══ LOGIN ══════════════════════════════════════════════════ */}
        {!authed && (
          <form onSubmit={login}>
            <div style={{ fontSize: 24, fontWeight: 800, color: NAVY, letterSpacing: -.6, marginBottom: 3 }}>
              Welcome back
            </div>
            <div style={{ fontSize: 14, color: '#9090A4', marginBottom: 26, lineHeight: 1.4 }}>
              Sign in to your Apex admin portal
            </div>

            <SectionLabel>Password</SectionLabel>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <input
                className="fi"
                style={{ ...baseInput, paddingRight: 56 }}
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
                  position: 'absolute', right: 0, top: 0, bottom: 0,
                  width: 52, background: 'none', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#9090A4', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                  letterSpacing: .3,
                }}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>

            {pwErr && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10,
                padding: '11px 14px', color: '#B91C1C', fontSize: 14, fontWeight: 500, marginBottom: 14,
              }}>
                {pwErr}
              </div>
            )}

            <PrimaryBtn className="pbtn" type="submit">Sign In</PrimaryBtn>
          </form>
        )}

        {/* ══ SUCCESS ════════════════════════════════════════════════ */}
        {authed && addSt === 'success' && result && (
          <div style={{ textAlign: 'center', padding: '4px 0' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(135deg, #D4AA40, #8C6E00)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, color: '#fff', margin: '0 auto 20px',
              boxShadow: '0 10px 30px rgba(196,165,53,.45)',
            }}>✓</div>

            <div style={{ fontSize: 21, fontWeight: 800, color: NAVY, letterSpacing: -.5, marginBottom: 6 }}>
              {bName} is live!
            </div>
            <div style={{ fontSize: 14, color: '#9090A4', marginBottom: 22, lineHeight: 1.4 }}>
              Program each card with this URL
            </div>

            <div style={{
              background: NAVY, borderRadius: 13,
              padding: '14px 16px', marginBottom: 18,
              fontFamily: "'SF Mono', 'Fira Mono', monospace",
              fontSize: 13, color: GOLD, fontWeight: 700,
              wordBreak: 'break-all', lineHeight: 1.6,
              border: '1px solid rgba(196,165,53,.15)',
            }}>
              {result.cardUrl}
            </div>

            <PrimaryBtn
              className="pbtn"
              onClick={copyUrl}
              style={{
                marginBottom: 10,
                background: copied
                  ? 'linear-gradient(135deg,#22C55E,#15803D)'
                  : undefined,
                boxShadow: copied
                  ? '0 4px 18px rgba(34,197,94,.35)'
                  : undefined,
              }}
            >
              {copied ? '✓  Copied to clipboard' : 'Copy URL'}
            </PrimaryBtn>
            <GhostBtn className="gbtn" onClick={reset}>Add Another Client</GhostBtn>
          </div>
        )}

        {/* ══ MAIN FORM ══════════════════════════════════════════════ */}
        {authed && addSt !== 'success' && (
          <form onSubmit={addClient}>

            {/* — Search — */}
            <SectionLabel>Search Business</SectionLabel>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <span style={{
                position: 'absolute', left: 13, top: '50%', transform: 'translateY(-52%)',
                fontSize: 18, lineHeight: 1, pointerEvents: 'none',
                color: picked ? GOLD : '#BBBBC8',
                transition: 'color .15s',
              }}>⌕</span>
              <input
                className="fi"
                style={{ ...baseInput, paddingLeft: 40 }}
                type="text"
                placeholder="Business name..."
                value={query}
                onChange={onQ}
                onFocus={() => { if (sugs.length > 0) setDrop(true) }}
                onBlur={() => { if (!inDrop.current) setDrop(false) }}
                autoComplete="off" autoCorrect="off"
                autoCapitalize="off" spellCheck="false"
              />

              {drop && sugs.length > 0 && (
                <div
                  onMouseDown={() => { inDrop.current = true }}
                  onMouseUp={() => { inDrop.current = false }}
                  onTouchStart={() => { inDrop.current = true }}
                  onTouchEnd={() => { inDrop.current = false }}
                  style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                    background: '#fff', borderRadius: 14, zIndex: 999,
                    boxShadow: '0 10px 36px rgba(0,0,0,.14), 0 0 0 1px rgba(0,0,0,.05)',
                    overflow: 'hidden',
                  }}
                >
                  {sugs.map((s, i) => {
                    const p    = s.placePrediction
                    const main = p?.structuredFormat?.mainText?.text || p?.text?.text || ''
                    const sec  = p?.structuredFormat?.secondaryText?.text || ''
                    return (
                      <div
                        key={i}
                        className="dr-row"
                        onMouseDown={e => { e.preventDefault(); pick(s) }}
                        onTouchEnd={e => { e.preventDefault(); pick(s) }}
                        style={{
                          padding: '13px 15px', background: '#fff',
                          borderBottom: i < sugs.length - 1 ? '1px solid #F0F0F6' : 'none',
                          minHeight: 54, display: 'flex', flexDirection: 'column', justifyContent: 'center',
                        }}
                      >
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#111', lineHeight: 1.3 }}>{main}</div>
                        {sec && <div style={{ fontSize: 12, color: '#A0A0B4', marginTop: 2, lineHeight: 1.3 }}>{sec}</div>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* — Pitch status — */}
            {pSt === 'checking' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 9,
                background: '#F6F6FA', border: '1px solid #EEEEF6',
                borderRadius: 11, padding: '12px 14px', marginBottom: 16,
                fontSize: 14, color: '#9090A4',
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#CCCCD8', flexShrink: 0 }} />
                Checking status...
              </div>
            )}

            {pSt === 'new' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 9,
                background: '#F0FDF4', border: '1px solid #BBF7D0',
                borderRadius: 11, padding: '12px 14px', marginBottom: 16,
                fontSize: 14, color: '#166534', fontWeight: 600,
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
                New lead — never been visited
              </div>
            )}

            {pSt === 'pitched' && (
              <div style={{
                background: '#FFFBEB', border: '1px solid #FDE68A',
                borderRadius: 11, padding: '12px 14px', marginBottom: 16,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  fontSize: 14, color: '#92400E', fontWeight: 700,
                  marginBottom: hist.length ? 10 : 0,
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                  Already visited
                </div>
                {hist.map((h, i) => (
                  <div key={i} style={{
                    borderTop: '1px solid rgba(253,230,138,.7)',
                    paddingTop: 8, marginTop: 8,
                    fontSize: 13, color: '#78350F', lineHeight: 1.7,
                  }}>
                    <strong>{h.visited_by}</strong>
                    <span style={{ color: '#A16207' }}> · {OUTCOMES[h.outcome] || h.outcome} · {fmtDate(h.visited_at)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* — Log visit — */}
            {picked && (pSt === 'new' || pSt === 'pitched') && logSt !== 'logged' && (
              <>
                <Divider />
                <SectionLabel>Log This Visit</SectionLabel>
                <input
                  className="fi"
                  style={{ ...baseInput, marginBottom: 8 }}
                  type="text"
                  placeholder="Your name"
                  value={rep}
                  onChange={e => setRep(e.target.value)}
                />
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <select
                    className="fi"
                    style={{ ...baseInput, paddingRight: 36, cursor: 'pointer', color: outcome ? '#0A0D1A' : '#A0A0B4' }}
                    value={outcome}
                    onChange={e => setOutcome(e.target.value)}
                  >
                    <option value="">Select outcome...</option>
                    <option value="pitched">Pitched — Awaiting Decision</option>
                    <option value="not_interested">Not Interested</option>
                    <option value="follow_up">Follow-Up Scheduled</option>
                    <option value="sold">Sold ✓</option>
                  </select>
                  <span style={{
                    position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
                    pointerEvents: 'none', color: '#BBBBC8', fontSize: 10,
                  }}>▼</span>
                </div>
                <GhostBtn
                  className="gbtn"
                  onClick={logVisit}
                  disabled={!rep.trim() || !outcome || logSt === 'loading'}
                >
                  {logSt === 'loading' ? 'Logging...' : 'Log Visit'}
                </GhostBtn>
                {logSt === 'error' && (
                  <div style={{ color: '#DC2626', fontSize: 13, marginTop: 8, fontWeight: 500 }}>
                    Failed — try again.
                  </div>
                )}
              </>
            )}

            {logSt === 'logged' && (
              <>
                <Divider />
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#F0FDF4', border: '1px solid #BBF7D0',
                  borderRadius: 11, padding: '12px 14px',
                  fontSize: 14, color: '#166534', fontWeight: 600,
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    background: '#22C55E', color: '#fff', fontSize: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>✓</span>
                  Visit logged successfully
                </div>
              </>
            )}

            {/* — Add client — */}
            {picked && pSt !== 'checking' && (
              <>
                <Divider />
                <SectionLabel>Add as Client</SectionLabel>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  fontSize: 14, fontWeight: 600, color: '#166534', marginBottom: 16,
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    background: '#22C55E', color: '#fff', fontSize: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>✓</span>
                  {bName}
                </div>

                <SectionLabel>Card URL Slug</SectionLabel>
                <input
                  className="fi"
                  style={{ ...baseInput, fontFamily: "'SF Mono','Fira Mono',monospace", letterSpacing: .4, marginBottom: 10 }}
                  type="text"
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                />

                {/* URL preview */}
                <div style={{
                  background: NAVY, borderRadius: 11,
                  padding: '12px 14px', marginBottom: 18,
                  fontFamily: "'SF Mono','Fira Mono',monospace",
                  fontSize: 13, lineHeight: 1.5, wordBreak: 'break-all',
                  border: '1px solid rgba(196,165,53,.12)',
                }}>
                  <span style={{ color: 'rgba(255,255,255,.28)' }}>{DOMAIN}/</span>
                  <span style={{ color: GOLD, fontWeight: 700 }}>{slug || '...'}</span>
                </div>

                {addSt === 'error' && (
                  <div style={{
                    background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10,
                    padding: '11px 14px', color: '#B91C1C', fontSize: 14, fontWeight: 500, marginBottom: 14,
                  }}>
                    {addErr}
                  </div>
                )}

                <PrimaryBtn className="pbtn" type="submit" disabled={!canAdd}>
                  {addSt === 'loading' ? 'Adding...' : 'Add Client'}
                </PrimaryBtn>
              </>
            )}

          </form>
        )}
      </div>
    </div>
  )
}
