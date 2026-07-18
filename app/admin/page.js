'use client'

import { useState, useRef, useEffect } from 'react'

const DOMAIN = 'go.apextapcards.com'
const GOLD = '#C8A84B'

const OUTCOMES = {
  pitched: 'Pitched — Awaiting Decision',
  not_interested: 'Not Interested',
  follow_up: 'Follow-Up Scheduled',
  sold: 'Sold',
}

function toSlug(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
}

function extractCity(fullText, businessName) {
  let text = fullText || ''
  if (businessName && text.toLowerCase().startsWith(businessName.toLowerCase())) {
    text = text.slice(businessName.length).replace(/^[,\s]+/, '')
  }
  const parts = text.split(',').map(p => p.trim()).filter(Boolean)
  const provIdx = parts.findIndex(p => /^[A-Z]{2}(\s|$)/.test(p))
  const limit = provIdx > 0 ? provIdx : parts.length
  for (let i = 0; i < limit; i++) {
    if (parts[i] && !/^\d/.test(parts[i])) return parts[i]
  }
  return ''
}

function fmt(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Shared UI pieces ────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{
          fontSize: 11, fontWeight: 700, color: '#8A8A9A',
          textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 7,
        }}>{label}</div>
      )}
      {children}
    </div>
  )
}

function GoldButton({ children, disabled, type = 'button', onClick, style = {} }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        height: 54,
        borderRadius: 14,
        border: 'none',
        background: disabled
          ? '#EBEBEB'
          : `linear-gradient(135deg, #D4AA50 0%, #9A7200 100%)`,
        color: disabled ? '#B0B0B0' : '#fff',
        fontSize: 16,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        letterSpacing: 0.2,
        boxShadow: disabled ? 'none' : '0 4px 18px rgba(200,168,75,0.4)',
        transition: 'opacity 0.15s',
        fontFamily: 'inherit',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

function OutlineButton({ children, onClick, style = {} }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        height: 50,
        borderRadius: 14,
        border: '1.5px solid #E0E0E0',
        background: 'transparent',
        color: '#555',
        fontSize: 15,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const [authed, setAuthed]         = useState(false)
  const [password, setPassword]     = useState('')
  const [pwError, setPwError]       = useState('')

  const [query, setQuery]           = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showDrop, setShowDrop]     = useState(false)
  const [selected, setSelected]     = useState(false)

  const [clientName, setClientName] = useState('')
  const [googleUrl, setGoogleUrl]   = useState('')
  const [placeId, setPlaceId]       = useState('')
  const [slug, setSlug]             = useState('')

  const [pitchStatus, setPitchStatus]   = useState(null)  // null | checking | new | pitched
  const [pitchHistory, setPitchHistory] = useState([])
  const [repName, setRepName]           = useState('')
  const [outcome, setOutcome]           = useState('')
  const [logStatus, setLogStatus]       = useState(null)  // null | loading | logged | error

  const [addStatus, setAddStatus]   = useState(null)  // null | loading | success | error
  const [addError, setAddError]     = useState('')
  const [result, setResult]         = useState(null)
  const [copied, setCopied]         = useState(false)

  const debounce  = useRef(null)
  const inDrop    = useRef(false)

  // ── Autocomplete ──────────────────────────────────────────────────────────

  async function fetchSuggestions(input) {
    if (input.length < 2) { setSuggestions([]); setShowDrop(false); return }
    try {
      const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
        body: JSON.stringify({ input, includedPrimaryTypes: ['establishment'] }),
      })
      const data = await res.json()
      const list = data.suggestions || []
      setSuggestions(list)
      setShowDrop(list.length > 0)
    } catch {}
  }

  function onQueryChange(e) {
    const v = e.target.value
    setQuery(v)
    setSelected(false)
    setClientName(''); setGoogleUrl(''); setPlaceId(''); setSlug('')
    setPitchStatus(null); setPitchHistory([]); setLogStatus(null)
    setAddStatus(null); setAddError('')
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => fetchSuggestions(v), 300)
  }

  function pickSuggestion(sug) {
    const pred = sug.placePrediction
    const name = pred?.structuredFormat?.mainText?.text || pred?.text?.text || ''
    const id   = pred?.placeId || ''
    const full = pred?.text?.text || ''
    const city = extractCity(full, name)
    const auto = city ? toSlug(name) + '-' + toSlug(city) : toSlug(name)

    setClientName(name)
    setGoogleUrl(`https://search.google.com/local/writereview?placeid=${id}`)
    setPlaceId(id)
    setSlug(auto)
    setQuery(name)
    setSelected(true)
    setSuggestions([]); setShowDrop(false)
    setPitchHistory([]); setLogStatus(null); setOutcome('')
    setAddStatus(null); setAddError('')

    checkPitch(id)
  }

  async function checkPitch(id) {
    setPitchStatus('checking')
    try {
      const res  = await fetch(`/api/check-pitch?placeId=${encodeURIComponent(id)}`)
      const data = await res.json()
      setPitchStatus(data.status)
      if (data.pitches) setPitchHistory(data.pitches)
    } catch {
      setPitchStatus('new')
    }
  }

  // ── Log visit ─────────────────────────────────────────────────────────────

  async function handleLogVisit() {
    if (!repName.trim() || !outcome) return
    setLogStatus('loading')
    try {
      const res = await fetch('/api/log-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place_id: placeId, business_name: clientName,
          visited_by: repName.trim(), outcome, password,
        }),
      })
      if (res.ok) {
        setLogStatus('logged')
        setPitchHistory(prev => [{ visited_by: repName.trim(), outcome, visited_at: new Date().toISOString() }, ...prev])
        if (pitchStatus === 'new') setPitchStatus('pitched')
      } else { setLogStatus('error') }
    } catch { setLogStatus('error') }
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async function handleLogin(e) {
    e.preventDefault()
    const res = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) { setAuthed(true); setPwError('') }
    else setPwError('Wrong password.')
  }

  // ── Add client ────────────────────────────────────────────────────────────

  async function handleAddClient(e) {
    e.preventDefault()
    if (!clientName || !googleUrl || !slug) return
    setAddStatus('loading'); setAddError('')
    const res = await fetch('/api/add-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, client_name: clientName, google_url: googleUrl, password }),
    })
    const data = await res.json()
    if (res.ok) {
      setAddStatus('success')
      setResult({ slug, cardUrl: `https://${DOMAIN}/${slug}` })
    } else {
      setAddStatus('error')
      setAddError(data.error || 'Something went wrong.')
    }
  }

  async function copyUrl() {
    if (!result) return
    await navigator.clipboard.writeText(result.cardUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function reset() {
    setAddStatus(null); setResult(null); setAddError(''); setCopied(false)
    setSelected(false); setQuery('')
    setClientName(''); setGoogleUrl(''); setPlaceId(''); setSlug('')
    setPitchStatus(null); setPitchHistory([])
    setLogStatus(null); setRepName(''); setOutcome('')
  }

  const canAdd = selected && slug.trim() && pitchStatus !== 'checking' && addStatus !== 'loading'

  // ─── Shared input style ───────────────────────────────────────────────────

  const inp = {
    width: '100%',
    height: 50,
    padding: '0 14px',
    borderRadius: 12,
    border: '1.5px solid #E2E2E8',
    fontSize: 16,        // must be 16+ to prevent iOS zoom
    color: '#111',
    background: '#FAFAFA',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    outline: 'none',
    WebkitAppearance: 'none',
    appearance: 'none',
  }

  // ─── Page wrapper ─────────────────────────────────────────────────────────
  //
  //  Layout: top-down, max-width 480px, centred. No vertical-centering trick
  //  (that's what broke mobile — centering a tall card with the keyboard open).
  //  Background is always the dark navy; on mobile it just fills the space above
  //  the white content section.

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080D1C',
      backgroundImage:
        'radial-gradient(ellipse 90% 40% at 50% 0%, rgba(200,168,75,0.15) 0%, transparent 65%)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>
      <style>{`
        .atc-inp:focus { border-color: ${GOLD} !important; background: #fff !important; box-shadow: 0 0 0 3px rgba(200,168,75,0.13) !important; }
        .atc-row:active { background: #F5F5F7 !important; }
        .atc-gbtn:active { opacity: 0.82; }
      `}</style>

      {/* ── Inner column ─────────────────────────────────────── */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 60px' }}>

        {/* ── Top bar ──────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 20px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: `linear-gradient(145deg, #D4AA50, #8B6A00)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 17, color: '#fff',
              boxShadow: '0 4px 14px rgba(200,168,75,0.45)',
              flexShrink: 0,
            }}>A</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: -0.3 }}>
                Apex Tap Cards
              </div>
              <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Admin Portal
              </div>
            </div>
          </div>

          {authed && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(200,168,75,0.1)', border: '1px solid rgba(200,168,75,0.22)',
              borderRadius: 20, padding: '5px 11px',
              color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: GOLD, boxShadow: `0 0 7px ${GOLD}`,
              }} />
              LIVE
            </div>
          )}
        </div>

        {/* ── White content area ────────────────────────────────── */}
        <div style={{
          background: '#fff',
          borderRadius: '22px 22px 0 0',
          minHeight: 'calc(100vh - 90px)',
          padding: '28px 20px 32px',
        }}>

          {/* ═══ LOGIN ════════════════════════════════════════════ */}
          {!authed && (
            <form onSubmit={handleLogin}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0B1120', letterSpacing: -0.6, marginBottom: 4 }}>
                Sign in
              </div>
              <div style={{ fontSize: 15, color: '#9A9AAA', marginBottom: 28 }}>
                Enter your password to continue
              </div>

              <Field label="Password">
                <input
                  className="atc-inp"
                  style={inp}
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoFocus
                />
              </Field>

              {pwError && (
                <div style={{
                  background: '#FEF2F2', border: '1px solid #FECACA',
                  borderRadius: 10, padding: '11px 14px',
                  color: '#DC2626', fontSize: 14, fontWeight: 500, marginBottom: 14,
                }}>{pwError}</div>
              )}

              <GoldButton type="submit">Sign In</GoldButton>
            </form>
          )}

          {/* ═══ SUCCESS ══════════════════════════════════════════ */}
          {authed && addStatus === 'success' && result && (
            <div style={{ textAlign: 'center', paddingTop: 12 }}>
              <div style={{
                width: 76, height: 76, borderRadius: '50%',
                background: `linear-gradient(135deg, #D4AA50, #8B6A00)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 34, color: '#fff', margin: '0 auto 20px',
                boxShadow: '0 8px 28px rgba(200,168,75,0.45)',
              }}>✓</div>

              <div style={{ fontSize: 22, fontWeight: 800, color: '#0B1120', letterSpacing: -0.5, marginBottom: 6 }}>
                {clientName} is live!
              </div>
              <div style={{ fontSize: 15, color: '#9A9AAA', marginBottom: 24 }}>
                Program each NFC card with this URL
              </div>

              <div style={{
                background: '#080D1C', borderRadius: 14,
                padding: '16px 14px', marginBottom: 18,
                fontFamily: 'monospace', fontSize: 14,
                color: GOLD, fontWeight: 700,
                wordBreak: 'break-all', lineHeight: 1.5,
                border: '1px solid rgba(200,168,75,0.15)',
              }}>
                {result.cardUrl}
              </div>

              <GoldButton
                onClick={copyUrl}
                style={{
                  marginBottom: 10,
                  background: copied
                    ? 'linear-gradient(135deg, #22C55E, #16A34A)'
                    : `linear-gradient(135deg, #D4AA50, #8B6A00)`,
                  boxShadow: copied
                    ? '0 4px 18px rgba(34,197,94,0.4)'
                    : '0 4px 18px rgba(200,168,75,0.4)',
                }}
              >
                {copied ? '✓ Copied!' : 'Copy URL'}
              </GoldButton>
              <OutlineButton onClick={reset}>Add Another Client</OutlineButton>
            </div>
          )}

          {/* ═══ MAIN FORM ════════════════════════════════════════ */}
          {authed && addStatus !== 'success' && (
            <form onSubmit={handleAddClient}>

              {/* Search */}
              <Field label="Search Business">
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: 14, top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 17, color: selected ? GOLD : '#C0C0CC',
                    pointerEvents: 'none', transition: 'color 0.15s',
                    lineHeight: 1,
                  }}>⌕</div>
                  <input
                    className="atc-inp"
                    style={{ ...inp, paddingLeft: 42 }}
                    type="text"
                    placeholder="Type a business name..."
                    value={query}
                    onChange={onQueryChange}
                    onFocus={() => { if (suggestions.length > 0) setShowDrop(true) }}
                    onBlur={() => { if (!inDrop.current) setShowDrop(false) }}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                  />

                  {/* Dropdown */}
                  {showDrop && suggestions.length > 0 && (
                    <div
                      onMouseDown={() => { inDrop.current = true }}
                      onMouseUp={() => { inDrop.current = false }}
                      onTouchStart={() => { inDrop.current = true }}
                      onTouchEnd={() => { inDrop.current = false }}
                      style={{
                        position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                        background: '#fff', borderRadius: 14, zIndex: 9999,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.13), 0 0 0 1px rgba(0,0,0,0.06)',
                        overflow: 'hidden',
                      }}
                    >
                      {suggestions.map((sug, i) => {
                        const pred = sug.placePrediction
                        const main = pred?.structuredFormat?.mainText?.text || pred?.text?.text || ''
                        const sec  = pred?.structuredFormat?.secondaryText?.text || ''
                        return (
                          <div
                            key={i}
                            className="atc-row"
                            onMouseDown={e => { e.preventDefault(); pickSuggestion(sug) }}
                            onTouchEnd={e => { e.preventDefault(); pickSuggestion(sug) }}
                            style={{
                              padding: '13px 16px',
                              borderBottom: i < suggestions.length - 1 ? '1px solid #F3F3F6' : 'none',
                              cursor: 'pointer',
                              minHeight: 56,
                              display: 'flex', flexDirection: 'column', justifyContent: 'center',
                            }}
                          >
                            <div style={{ fontSize: 15, fontWeight: 600, color: '#111', lineHeight: 1.3 }}>{main}</div>
                            {sec && <div style={{ fontSize: 13, color: '#A0A0B0', marginTop: 2, lineHeight: 1.3 }}>{sec}</div>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </Field>

              {/* Status banner */}
              {pitchStatus === 'checking' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#F5F5F8', borderRadius: 12,
                  padding: '13px 16px', marginBottom: 20,
                  fontSize: 14, color: '#9A9AAA',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#D0D0DC', flexShrink: 0 }} />
                  Checking visit history...
                </div>
              )}

              {pitchStatus === 'new' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#F0FDF4', border: '1px solid #BBF7D0',
                  borderRadius: 12, padding: '13px 16px', marginBottom: 20,
                  fontSize: 14, color: '#15803D', fontWeight: 600,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
                  New lead — never been visited
                </div>
              )}

              {pitchStatus === 'pitched' && (
                <div style={{
                  background: '#FFFBEB', border: '1px solid #FDE68A',
                  borderRadius: 12, padding: '13px 16px', marginBottom: 20,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: 14, color: '#92400E', fontWeight: 700,
                    marginBottom: pitchHistory.length ? 10 : 0,
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                    Already visited
                  </div>
                  {pitchHistory.map((h, i) => (
                    <div key={i} style={{
                      borderTop: '1px solid rgba(253,230,138,0.8)',
                      paddingTop: 8, marginTop: 8,
                      fontSize: 13, color: '#78350F', lineHeight: 1.6,
                    }}>
                      <span style={{ fontWeight: 700 }}>{h.visited_by}</span>
                      {' · '}
                      <span>{OUTCOMES[h.outcome] || h.outcome}</span>
                      {' · '}
                      <span style={{ color: '#A16207' }}>{fmt(h.visited_at)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Log visit */}
              {selected && (pitchStatus === 'new' || pitchStatus === 'pitched') && logStatus !== 'logged' && (
                <div style={{
                  background: '#F8F8FB', borderRadius: 16,
                  padding: '18px 16px', marginBottom: 20,
                  border: '1px solid #EBEBF0',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#8A8A9A', textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 12 }}>
                    Log This Visit
                  </div>
                  <input
                    className="atc-inp"
                    style={{ ...inp, background: '#fff', marginBottom: 8 }}
                    type="text"
                    placeholder="Your name"
                    value={repName}
                    onChange={e => setRepName(e.target.value)}
                  />
                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <select
                      className="atc-inp"
                      style={{
                        ...inp, background: '#fff',
                        paddingRight: 36,
                        color: outcome ? '#111' : '#9A9AAA',
                        cursor: 'pointer',
                      }}
                      value={outcome}
                      onChange={e => setOutcome(e.target.value)}
                    >
                      <option value="">Select outcome...</option>
                      <option value="pitched">Pitched — Awaiting Decision</option>
                      <option value="not_interested">Not Interested</option>
                      <option value="follow_up">Follow-Up Scheduled</option>
                      <option value="sold">Sold ✓</option>
                    </select>
                    <div style={{
                      position: 'absolute', right: 14, top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none', color: '#9A9AAA', fontSize: 11,
                    }}>▼</div>
                  </div>
                  <OutlineButton
                    onClick={handleLogVisit}
                    style={{
                      opacity: !repName.trim() || !outcome || logStatus === 'loading' ? 0.4 : 1,
                      cursor: !repName.trim() || !outcome ? 'not-allowed' : 'pointer',
                      background: '#fff',
                    }}
                  >
                    {logStatus === 'loading' ? 'Logging...' : 'Log Visit'}
                  </OutlineButton>
                  {logStatus === 'error' && (
                    <div style={{ color: '#DC2626', fontSize: 13, marginTop: 8 }}>Failed — try again.</div>
                  )}
                </div>
              )}

              {logStatus === 'logged' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#F0FDF4', border: '1px solid #BBF7D0',
                  borderRadius: 12, padding: '12px 14px', marginBottom: 20,
                  fontSize: 14, color: '#15803D', fontWeight: 600,
                }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#22C55E', color: '#fff', fontSize: 11,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>✓</span>
                  Visit logged
                </div>
              )}

              {/* Add client section */}
              {selected && pitchStatus !== 'checking' && (
                <div style={{
                  background: '#F8F8FB', borderRadius: 16,
                  padding: '18px 16px',
                  border: '1px solid #EBEBF0',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#8A8A9A', textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 12 }}>
                    Add as Client
                  </div>

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 14, color: '#15803D', fontWeight: 600,
                    marginBottom: 16,
                  }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#22C55E', color: '#fff', fontSize: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>✓</span>
                    {clientName}
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, color: '#8A8A9A', textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 7 }}>
                    URL Slug
                  </div>
                  <input
                    className="atc-inp"
                    style={{ ...inp, background: '#fff', fontFamily: 'monospace', letterSpacing: 0.3, marginBottom: 10 }}
                    type="text"
                    value={slug}
                    onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  />

                  {/* URL preview */}
                  <div style={{
                    background: '#080D1C', borderRadius: 10,
                    padding: '11px 13px', marginBottom: 16,
                    fontFamily: 'monospace', fontSize: 13, lineHeight: 1.5,
                    border: '1px solid rgba(200,168,75,0.12)',
                    wordBreak: 'break-all',
                  }}>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>{DOMAIN}/</span>
                    <span style={{ color: GOLD, fontWeight: 700 }}>{slug || '...'}</span>
                  </div>

                  {addStatus === 'error' && (
                    <div style={{
                      background: '#FEF2F2', border: '1px solid #FECACA',
                      borderRadius: 10, padding: '11px 14px', marginBottom: 14,
                      color: '#DC2626', fontSize: 14, fontWeight: 500,
                    }}>{addError}</div>
                  )}

                  <GoldButton type="submit" disabled={!canAdd}>
                    {addStatus === 'loading' ? 'Adding...' : 'Add Client'}
                  </GoldButton>
                </div>
              )}

            </form>
          )}

        </div>
      </div>
    </div>
  )
}
