'use client'

import { useState, useRef, useEffect } from 'react'

const DOMAIN = 'go.apextapcards.com'

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

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [placeSelected, setPlaceSelected] = useState(false)

  const [clientName, setClientName] = useState('')
  const [googleUrl, setGoogleUrl] = useState('')
  const [placeId, setPlaceId] = useState('')
  const [slug, setSlug] = useState('')

  const [pitchStatus, setPitchStatus] = useState(null)
  const [pitchHistory, setPitchHistory] = useState([])
  const [repName, setRepName] = useState('')
  const [visitOutcome, setVisitOutcome] = useState('')
  const [logStatus, setLogStatus] = useState(null)

  const [submitStatus, setSubmitStatus] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [result, setResult] = useState(null)

  const debounceRef = useRef(null)
  const dropdownMouseDown = useRef(false)

  async function fetchSuggestions(input) {
    if (input.length < 2) { setSuggestions([]); setShowDropdown(false); return }
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
      setShowDropdown(list.length > 0)
    } catch (err) { console.error('Autocomplete error:', err) }
  }

  function handleQueryChange(e) {
    const val = e.target.value
    setQuery(val)
    setPlaceSelected(false)
    setClientName(''); setGoogleUrl(''); setPlaceId(''); setSlug('')
    setPitchStatus(null); setPitchHistory([]); setLogStatus(null)
    setSubmitStatus(null); setErrorMsg('')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  async function checkPitchHistory(id) {
    setPitchStatus('checking')
    try {
      const res = await fetch(`/api/check-pitch?placeId=${encodeURIComponent(id)}`)
      const data = await res.json()
      setPitchStatus(data.status)
      if (data.pitches) setPitchHistory(data.pitches)
    } catch {
      setPitchStatus('new')
    }
  }

  function handleSelect(suggestion) {
    const pred = suggestion.placePrediction
    const name = pred?.structuredFormat?.mainText?.text || pred?.text?.text || ''
    const id = pred?.placeId || ''
    const fullText = pred?.text?.text || ''
    const city = extractCity(fullText, name)
    const autoSlug = city ? toSlug(name) + '-' + toSlug(city) : toSlug(name)
    setClientName(name)
    setGoogleUrl(`https://search.google.com/local/writereview?placeid=${id}`)
    setPlaceId(id)
    setSlug(autoSlug)
    setQuery(name)
    setPlaceSelected(true)
    setSuggestions([])
    setShowDropdown(false)
    setPitchHistory([]); setLogStatus(null); setVisitOutcome('')
    setSubmitStatus(null); setErrorMsg('')
    checkPitchHistory(id)
  }

  async function handleLogVisit() {
    if (!repName.trim() || !visitOutcome) return
    setLogStatus('loading')
    try {
      const res = await fetch('/api/log-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place_id: placeId,
          business_name: clientName,
          visited_by: repName.trim(),
          outcome: visitOutcome,
          password,
        }),
      })
      if (res.ok) {
        setLogStatus('logged')
        setPitchHistory(prev => [{
          visited_by: repName.trim(),
          outcome: visitOutcome,
          visited_at: new Date().toISOString(),
        }, ...prev])
        if (pitchStatus === 'new') setPitchStatus('pitched')
      } else { setLogStatus('error') }
    } catch { setLogStatus('error') }
  }

  async function handleLogin(e) {
    e.preventDefault()
    const res = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) { setAuthed(true); setPasswordError('') }
    else { setPasswordError('Incorrect password.') }
  }

  async function handleAddClient(e) {
    e.preventDefault()
    if (!clientName || !googleUrl || !slug) return
    setSubmitStatus('loading'); setErrorMsg('')
    const res = await fetch('/api/add-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, client_name: clientName, google_url: googleUrl, password }),
    })
    const data = await res.json()
    if (res.ok) {
      setSubmitStatus('success')
      setResult({ slug, cardUrl: `https://${DOMAIN}/${slug}` })
    } else {
      setSubmitStatus('error')
      setErrorMsg(data.error || 'Something went wrong.')
    }
  }

  function reset() {
    setSubmitStatus(null); setResult(null); setErrorMsg('')
    setPlaceSelected(false); setQuery('')
    setClientName(''); setGoogleUrl(''); setPlaceId(''); setSlug('')
    setPitchStatus(null); setPitchHistory([])
    setLogStatus(null); setRepName(''); setVisitOutcome('')
  }

  const canSubmit = placeSelected && slug.trim() && pitchStatus !== 'checking' && submitStatus !== 'loading'

  // ─── Styles ──────────────────────────────────────────────────────────────────

  const gold = '#C9A227'
  const goldDark = '#A67C00'
  const navy = '#0B1120'
  const navyMid = '#131d35'

  const S = {
    page: {
      minHeight: '100vh',
      background: `linear-gradient(160deg, #080d1a 0%, #0f1c38 50%, #080d1a 100%)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      padding: '32px 16px',
      position: 'relative',
    },
    noise: {
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
      backgroundImage: `
        radial-gradient(ellipse 80% 50% at 20% 20%, rgba(201,162,39,0.07) 0%, transparent 60%),
        radial-gradient(ellipse 60% 40% at 80% 80%, rgba(201,162,39,0.05) 0%, transparent 60%)
      `,
    },
    wrap: {
      position: 'relative', zIndex: 1,
      width: '100%', maxWidth: '480px',
    },
    brandRow: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: '20px', padding: '0 2px',
    },
    brandLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
    brandIcon: {
      width: '36px', height: '36px', borderRadius: '10px',
      background: `linear-gradient(145deg, ${gold}, ${goldDark})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '18px', color: '#fff', fontWeight: '800',
      boxShadow: `0 4px 12px rgba(201,162,39,0.4)`,
      letterSpacing: '-1px',
    },
    brandName: {
      color: '#fff', fontWeight: '700', fontSize: '15px', letterSpacing: '-0.3px',
    },
    brandSub: {
      color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '500',
      letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: '1px',
    },
    liveBadge: {
      display: 'flex', alignItems: 'center', gap: '6px',
      background: 'rgba(201,162,39,0.1)', border: '1px solid rgba(201,162,39,0.2)',
      borderRadius: '20px', padding: '5px 12px',
      color: gold, fontSize: '11px', fontWeight: '700', letterSpacing: '0.8px',
    },
    liveDot: {
      width: '6px', height: '6px', borderRadius: '50%', background: gold,
      boxShadow: `0 0 6px ${gold}`,
    },
    card: {
      background: 'rgba(255,255,255,0.97)',
      borderRadius: '24px',
      padding: '40px',
      boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
      backdropFilter: 'blur(20px)',
    },
    cardTitle: {
      fontSize: '22px', fontWeight: '800', color: '#0B1120',
      letterSpacing: '-0.6px', marginBottom: '4px',
    },
    cardSub: {
      fontSize: '14px', color: '#9CA3AF', marginBottom: '28px',
    },
    divider: { borderTop: '1px solid #F0F0F0', margin: '24px 0' },
    label: {
      fontSize: '11px', fontWeight: '700', color: '#9CA3AF',
      textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px',
      display: 'block',
    },
    input: {
      width: '100%', padding: '13px 16px', borderRadius: '12px',
      border: '1.5px solid #E8E8E8', fontSize: '15px', color: '#111',
      background: '#FAFAFA', outline: 'none', boxSizing: 'border-box',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      fontFamily: 'inherit',
    },
    inputFocused: {
      borderColor: gold,
      boxShadow: `0 0 0 3px rgba(201,162,39,0.12)`,
    },
    goldBtn: {
      width: '100%', padding: '14px', borderRadius: '12px',
      background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
      color: '#fff', border: 'none', fontSize: '15px', fontWeight: '700',
      cursor: 'pointer', letterSpacing: '0.2px',
      boxShadow: `0 4px 16px rgba(201,162,39,0.35)`,
      transition: 'opacity 0.15s, transform 0.1s',
    },
    ghostBtn: {
      width: '100%', padding: '13px', borderRadius: '12px',
      background: 'transparent', color: '#6B7280',
      border: '1.5px solid #E8E8E8', fontSize: '14px', fontWeight: '600',
      cursor: 'pointer', transition: 'border-color 0.15s',
    },
    disabledBtn: {
      width: '100%', padding: '14px', borderRadius: '12px',
      background: '#F3F4F6', color: '#C0C0C0',
      border: 'none', fontSize: '15px', fontWeight: '700',
      cursor: 'not-allowed',
    },
    pill: (color, bg, border) => ({
      display: 'inline-flex', alignItems: 'center', gap: '7px',
      background: bg, border: `1px solid ${border}`, borderRadius: '10px',
      padding: '9px 14px', fontSize: '13px', color, fontWeight: '600',
      width: '100%', boxSizing: 'border-box',
    }),
    dot: (color) => ({
      width: '8px', height: '8px', borderRadius: '50%',
      background: color, flexShrink: 0,
    }),
    monoBg: {
      fontFamily: 'monospace', fontSize: '13px',
      background: '#F6F4FF', borderRadius: '10px',
      padding: '10px 14px', color: '#5B50A0',
      border: '1px solid #EAE8F8', wordBreak: 'break-all',
    },
  }

  // ─── Login ────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={S.page}>
        <div style={S.noise} />
        <div style={S.wrap}>
          <div style={S.brandRow}>
            <div style={S.brandLeft}>
              <div style={S.brandIcon}>A</div>
              <div>
                <div style={S.brandName}>Apex Tap Cards</div>
                <div style={S.brandSub}>Admin Portal</div>
              </div>
            </div>
          </div>
          <div style={S.card}>
            <div style={S.cardTitle}>Welcome back</div>
            <div style={S.cardSub}>Sign in to manage clients and track visits</div>
            <form onSubmit={handleLogin}>
              <label style={S.label}>Password</label>
              <input
                style={{ ...S.input, marginBottom: '16px' }}
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                onFocus={e => Object.assign(e.target.style, S.inputFocused)}
                onBlur={e => { e.target.style.borderColor = '#E8E8E8'; e.target.style.boxShadow = 'none' }}
              />
              {passwordError && (
                <div style={{
                  color: '#DC2626', fontSize: '13px', marginBottom: '14px',
                  background: '#FEF2F2', padding: '10px 14px', borderRadius: '10px',
                  border: '1px solid #FECACA',
                }}>
                  {passwordError}
                </div>
              )}
              <button style={S.goldBtn} type="submit">Sign In →</button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // ─── Success ──────────────────────────────────────────────────────────────
  if (submitStatus === 'success' && result) {
    return (
      <div style={S.page}>
        <div style={S.noise} />
        <div style={S.wrap}>
          <div style={S.brandRow}>
            <div style={S.brandLeft}>
              <div style={S.brandIcon}>A</div>
              <div>
                <div style={S.brandName}>Apex Tap Cards</div>
                <div style={S.brandSub}>Admin Portal</div>
              </div>
            </div>
            <div style={S.liveBadge}>
              <div style={S.liveDot} />
              LIVE
            </div>
          </div>
          <div style={{ ...S.card, textAlign: 'center' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: `linear-gradient(135deg, ${gold}, ${goldDark})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '32px', margin: '0 auto 20px',
              boxShadow: `0 8px 24px rgba(201,162,39,0.4)`,
            }}>✓</div>
            <div style={{ fontSize: '21px', fontWeight: '800', color: '#0B1120', marginBottom: '6px', letterSpacing: '-0.5px' }}>
              {clientName} is live!
            </div>
            <div style={{ fontSize: '14px', color: '#9CA3AF', marginBottom: '28px' }}>
              Program each NFC card with this URL
            </div>
            <div style={{
              background: navy, borderRadius: '14px', padding: '18px',
              fontFamily: 'monospace', fontSize: '15px',
              color: gold, fontWeight: '700', marginBottom: '20px',
              wordBreak: 'break-all', border: `1px solid rgba(201,162,39,0.15)`,
              letterSpacing: '-0.3px',
            }}>
              {result.cardUrl}
            </div>
            <button
              style={{ ...S.goldBtn, marginBottom: '10px' }}
              onClick={() => navigator.clipboard.writeText(result.cardUrl)}
            >
              Copy URL
            </button>
            <button style={S.ghostBtn} onClick={reset}>
              Add Another Client
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Main form ────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.noise} />
      <div style={S.wrap}>
        <div style={S.brandRow}>
          <div style={S.brandLeft}>
            <div style={S.brandIcon}>A</div>
            <div>
              <div style={S.brandName}>Apex Tap Cards</div>
              <div style={S.brandSub}>Admin Portal</div>
            </div>
          </div>
          <div style={S.liveBadge}>
            <div style={S.liveDot} />
            LIVE
          </div>
        </div>

        <div style={S.card}>
          <form onSubmit={handleAddClient}>

            {/* ── Search ─────────────────────────────────────────── */}
            <div style={{ marginBottom: '20px' }}>
              <label style={S.label}>Search Business</label>
              <div style={{ position: 'relative' }}>
                {/* Search icon */}
                <div style={{
                  position: 'absolute', left: '15px', top: '50%',
                  transform: 'translateY(-50%)', color: '#C0C0C0',
                  fontSize: '15px', pointerEvents: 'none', zIndex: 1,
                }}>
                  ⌕
                </div>
                <input
                  style={{
                    ...S.input,
                    paddingLeft: '40px',
                    borderColor: placeSelected ? gold : '#E8E8E8',
                    boxShadow: placeSelected ? `0 0 0 3px rgba(201,162,39,0.12)` : 'none',
                  }}
                  type="text"
                  placeholder="Type a business name..."
                  value={query}
                  onChange={handleQueryChange}
                  onFocus={() => { if (suggestions.length > 0) setShowDropdown(true) }}
                  onBlur={() => {
                    // Only close if the user isn't clicking inside the dropdown
                    if (!dropdownMouseDown.current) setShowDropdown(false)
                  }}
                  autoComplete="off"
                />

                {/* Dropdown */}
                {showDropdown && suggestions.length > 0 && (
                  <div
                    onMouseDown={() => { dropdownMouseDown.current = true }}
                    onMouseUp={() => { dropdownMouseDown.current = false }}
                    style={{
                      position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                      background: '#fff', borderRadius: '14px', zIndex: 9999,
                      boxShadow: '0 12px 40px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
                      overflow: 'hidden',
                    }}
                  >
                    {suggestions.map((sug, i) => {
                      const pred = sug.placePrediction
                      const main = pred?.structuredFormat?.mainText?.text || pred?.text?.text || ''
                      const secondary = pred?.structuredFormat?.secondaryText?.text || ''
                      return (
                        <div
                          key={i}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleSelect(sug)
                          }}
                          style={{
                            padding: '12px 16px', cursor: 'pointer',
                            borderBottom: i < suggestions.length - 1 ? '1px solid #F5F5F5' : 'none',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#111' }}>{main}</div>
                          {secondary && (
                            <div style={{ fontSize: '12px', color: '#A0A0A0', marginTop: '2px' }}>{secondary}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Status badge ───────────────────────────────────── */}
            {pitchStatus === 'checking' && (
              <div style={{ ...S.pill('rgba(0,0,0,0.35)', '#F9F9F9', '#EBEBEB'), marginBottom: '20px' }}>
                <div style={{ ...S.dot('#D1D5DB') }} />
                Checking status...
              </div>
            )}

            {pitchStatus === 'new' && (
              <div style={{ ...S.pill('#15803D', '#F0FDF4', '#BBF7D0'), marginBottom: '20px' }}>
                <div style={{ ...S.dot('#22C55E') }} />
                New lead — never been visited
              </div>
            )}

            {pitchStatus === 'pitched' && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#92400E', fontWeight: '700', marginBottom: pitchHistory.length ? '12px' : 0 }}>
                  <div style={{ ...S.dot('#F59E0B') }} />
                  Already visited
                </div>
                {pitchHistory.map((p, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '1fr 1.6fr 1fr',
                    fontSize: '12px', color: '#78350F',
                    padding: '7px 0', gap: '8px',
                    borderTop: '1px solid #FDE68A',
                  }}>
                    <span style={{ fontWeight: '700' }}>{p.visited_by}</span>
                    <span style={{ color: '#92400E' }}>{OUTCOMES[p.outcome] || p.outcome}</span>
                    <span style={{ color: '#A16207', textAlign: 'right' }}>{formatDate(p.visited_at)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Log visit ──────────────────────────────────────── */}
            {placeSelected && (pitchStatus === 'new' || pitchStatus === 'pitched') && logStatus !== 'logged' && (
              <>
                <div style={S.divider} />
                <label style={S.label}>Log This Visit</label>
                <input
                  style={{ ...S.input, marginBottom: '8px' }}
                  type="text"
                  placeholder="Your name"
                  value={repName}
                  onChange={e => setRepName(e.target.value)}
                  onFocus={e => Object.assign(e.target.style, S.inputFocused)}
                  onBlur={e => { e.target.style.borderColor = '#E8E8E8'; e.target.style.boxShadow = 'none' }}
                />
                <select
                  style={{ ...S.input, marginBottom: '8px', appearance: 'none', cursor: 'pointer' }}
                  value={visitOutcome}
                  onChange={e => setVisitOutcome(e.target.value)}
                >
                  <option value="">Select outcome...</option>
                  <option value="pitched">Pitched — Awaiting Decision</option>
                  <option value="not_interested">Not Interested</option>
                  <option value="follow_up">Follow-Up Scheduled</option>
                  <option value="sold">Sold ✓</option>
                </select>
                <button
                  type="button"
                  style={{
                    ...S.ghostBtn,
                    opacity: !repName.trim() || !visitOutcome || logStatus === 'loading' ? 0.4 : 1,
                    cursor: !repName.trim() || !visitOutcome ? 'not-allowed' : 'pointer',
                  }}
                  onClick={handleLogVisit}
                  disabled={!repName.trim() || !visitOutcome || logStatus === 'loading'}
                >
                  {logStatus === 'loading' ? 'Logging...' : 'Log Visit'}
                </button>
                {logStatus === 'error' && (
                  <div style={{ color: '#DC2626', fontSize: '12px', marginTop: '8px' }}>Failed to log — try again.</div>
                )}
              </>
            )}

            {logStatus === 'logged' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#15803D', fontSize: '13px', fontWeight: '700', marginTop: '4px' }}>
                <span style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: '#22C55E', color: '#fff', fontSize: '11px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✓</span>
                Visit logged successfully
              </div>
            )}

            {/* ── Add client ─────────────────────────────────────── */}
            {placeSelected && pitchStatus !== 'checking' && (
              <>
                <div style={S.divider} />

                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: '#F0FDF4', border: '1px solid #BBF7D0',
                  borderRadius: '10px', padding: '10px 14px', marginBottom: '20px',
                  fontSize: '13px', color: '#15803D', fontWeight: '600',
                }}>
                  <span>✓</span> {clientName} — review link ready
                </div>

                <label style={S.label}>Card URL Slug</label>
                <input
                  style={{
                    ...S.input,
                    fontFamily: 'monospace', fontSize: '14px',
                    letterSpacing: '0.2px', marginBottom: '8px',
                  }}
                  type="text"
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  onFocus={e => Object.assign(e.target.style, S.inputFocused)}
                  onBlur={e => { e.target.style.borderColor = '#E8E8E8'; e.target.style.boxShadow = 'none' }}
                />
                <div style={{ ...S.monoBg, marginBottom: '22px' }}>
                  <span style={{ color: '#A0A0A0' }}>{DOMAIN}/</span>
                  <span style={{ color: gold, fontWeight: '700' }}>{slug || '...'}</span>
                </div>

                {submitStatus === 'error' && (
                  <div style={{
                    color: '#DC2626', fontSize: '13px', marginBottom: '16px',
                    background: '#FEF2F2', borderRadius: '10px', padding: '12px 14px',
                    border: '1px solid #FECACA', fontWeight: '500',
                  }}>{errorMsg}</div>
                )}

                {canSubmit
                  ? <button style={S.goldBtn} type="submit">
                      {submitStatus === 'loading' ? 'Adding...' : 'Add Client →'}
                    </button>
                  : <button style={S.disabledBtn} type="button" disabled>
                      Add Client
                    </button>
                }
              </>
            )}

          </form>
        </div>
      </div>
    </div>
  )
}
