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
  const [mobile, setMobile] = useState(false)
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
  const [copied, setCopied] = useState(false)

  const debounceRef = useRef(null)
  const dropdownRef = useRef(null)
  const dropdownMouseDown = useRef(false)

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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

  async function copyUrl() {
    if (!result) return
    await navigator.clipboard.writeText(result.cardUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function reset() {
    setSubmitStatus(null); setResult(null); setErrorMsg(''); setCopied(false)
    setPlaceSelected(false); setQuery('')
    setClientName(''); setGoogleUrl(''); setPlaceId(''); setSlug('')
    setPitchStatus(null); setPitchHistory([])
    setLogStatus(null); setRepName(''); setVisitOutcome('')
  }

  const canSubmit = placeSelected && slug.trim() && pitchStatus !== 'checking' && submitStatus !== 'loading'

  // ─── Design tokens ────────────────────────────────────────────────────────
  const gold = '#C9A227'
  const goldDark = '#8B6A00'
  const p = mobile ? '24px 20px' : '40px 36px'
  const r = mobile ? '20px' : '24px'
  const inputH = '52px'
  const btnH = mobile ? '56px' : '52px'

  const inputBase = {
    width: '100%',
    height: inputH,
    padding: '0 16px',
    borderRadius: '12px',
    border: '1.5px solid #E8E8EC',
    fontSize: '16px', // 16px prevents iOS zoom
    color: '#0D1117',
    background: '#FAFAFA',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    WebkitAppearance: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  const goldGradient = `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`

  // ─── Page shell ───────────────────────────────────────────────────────────
  const Shell = ({ children }) => (
    <div style={{
      minHeight: '100dvh',
      background: '#06091A',
      backgroundImage: `
        radial-gradient(ellipse 100% 45% at 50% 0%, rgba(201,162,39,0.18) 0%, transparent 65%),
        radial-gradient(ellipse 70% 35% at 10% 100%, rgba(15,30,80,0.6) 0%, transparent 60%)
      `,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      padding: mobile ? '20px 0 40px' : '40px 16px',
    }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          0%   { opacity: 0; transform: scale(0.7); }
          70%  { transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .atc-input:focus {
          border-color: ${gold} !important;
          box-shadow: 0 0 0 3px rgba(201,162,39,0.15) !important;
          background: #fff !important;
        }
        .atc-btn-gold:active { opacity: 0.85; transform: scale(0.98); }
        .atc-btn-ghost:active { background: #F5F5F5 !important; }
        .atc-drop-item:active { background: #F5F5F7 !important; }
      `}</style>
      {children}
    </div>
  )

  // ─── Brand bar ────────────────────────────────────────────────────────────
  const Brand = ({ live }) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      width: '100%', marginBottom: '16px',
      padding: mobile ? '0 20px' : '0 4px',
      animation: 'fadeUp 0.4s ease both',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          background: goldGradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', fontWeight: '800', color: '#fff',
          boxShadow: `0 6px 20px rgba(201,162,39,0.45)`,
          letterSpacing: '-1px', flexShrink: 0,
        }}>A</div>
        <div>
          <div style={{
            color: '#FFFFFF', fontWeight: '700', fontSize: '15px',
            letterSpacing: '-0.3px', lineHeight: 1.2,
          }}>Apex Tap Cards</div>
          <div style={{
            color: 'rgba(255,255,255,0.38)', fontSize: '11px',
            letterSpacing: '0.6px', textTransform: 'uppercase', marginTop: '1px',
          }}>Admin Portal</div>
        </div>
      </div>
      {live && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'rgba(201,162,39,0.1)',
          border: '1px solid rgba(201,162,39,0.22)',
          borderRadius: '20px', padding: '5px 12px',
          color: gold, fontSize: '11px', fontWeight: '700', letterSpacing: '0.8px',
        }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: gold, boxShadow: `0 0 8px ${gold}`,
            animation: 'pulse 2s ease infinite',
          }} />
          LIVE
        </div>
      )}
    </div>
  )

  // ─── Card ─────────────────────────────────────────────────────────────────
  const Card = ({ children, style = {} }) => (
    <div style={{
      width: mobile ? 'calc(100% - 32px)' : '100%',
      maxWidth: '460px',
      background: '#FFFFFF',
      borderRadius: r,
      padding: p,
      boxShadow: '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
      animation: 'fadeUp 0.4s ease 0.05s both',
      ...style,
    }}>
      {children}
    </div>
  )

  // ─── Input helper ─────────────────────────────────────────────────────────
  const Input = ({ style: s = {}, ...props }) => (
    <input
      className="atc-input"
      style={{ ...inputBase, ...s }}
      {...props}
    />
  )

  // ─── Label helper ─────────────────────────────────────────────────────────
  const Label = ({ children }) => (
    <div style={{
      fontSize: '11px', fontWeight: '700', color: '#A0A0B0',
      textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px',
    }}>{children}</div>
  )

  const Divider = () => (
    <div style={{ borderTop: '1px solid #F0F0F4', margin: '22px 0' }} />
  )

  // ─── Login ────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <Shell>
        <Brand live={false} />
        <Card>
          <div style={{
            fontSize: mobile ? '26px' : '24px', fontWeight: '800',
            color: '#0D1117', letterSpacing: '-0.7px', marginBottom: '4px',
          }}>
            Welcome back
          </div>
          <div style={{ fontSize: '15px', color: '#9CA3AF', marginBottom: '28px' }}>
            Sign in to manage your clients
          </div>

          <form onSubmit={handleLogin}>
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              style={{ marginBottom: '14px' }}
            />
            {passwordError && (
              <div style={{
                color: '#DC2626', fontSize: '14px', marginBottom: '14px',
                background: '#FEF2F2', padding: '12px 14px', borderRadius: '10px',
                border: '1px solid #FECACA', fontWeight: '500',
              }}>
                {passwordError}
              </div>
            )}
            <button
              className="atc-btn-gold"
              type="submit"
              style={{
                width: '100%', height: btnH, borderRadius: '12px',
                background: goldGradient,
                color: '#fff', border: 'none', fontSize: '16px', fontWeight: '700',
                cursor: 'pointer', letterSpacing: '0.1px',
                boxShadow: `0 6px 20px rgba(201,162,39,0.4)`,
                transition: 'opacity 0.15s, transform 0.1s',
              }}
            >
              Sign In
            </button>
          </form>
        </Card>
      </Shell>
    )
  }

  // ─── Success ──────────────────────────────────────────────────────────────
  if (submitStatus === 'success' && result) {
    return (
      <Shell>
        <Brand live={true} />
        <Card style={{ textAlign: 'center' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: goldGradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '36px', margin: '0 auto 20px',
            boxShadow: `0 10px 32px rgba(201,162,39,0.5)`,
            animation: 'popIn 0.5s cubic-bezier(.36,.07,.19,.97) both',
          }}>✓</div>

          <div style={{
            fontSize: mobile ? '24px' : '22px', fontWeight: '800',
            color: '#0D1117', letterSpacing: '-0.6px', marginBottom: '6px',
          }}>
            {clientName} is live!
          </div>
          <div style={{ fontSize: '15px', color: '#9CA3AF', marginBottom: '28px' }}>
            Program each NFC card with this URL
          </div>

          <div style={{
            background: '#06091A',
            borderRadius: '14px', padding: '18px 16px',
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            fontSize: mobile ? '13px' : '14px',
            color: gold, fontWeight: '600',
            marginBottom: '20px', wordBreak: 'break-all',
            border: `1px solid rgba(201,162,39,0.18)`,
            letterSpacing: '0.1px', lineHeight: 1.5,
          }}>
            {result.cardUrl}
          </div>

          <button
            className="atc-btn-gold"
            onClick={copyUrl}
            style={{
              width: '100%', height: btnH, borderRadius: '12px',
              background: copied ? 'linear-gradient(135deg, #22C55E, #16A34A)' : goldGradient,
              color: '#fff', border: 'none', fontSize: '16px', fontWeight: '700',
              cursor: 'pointer', marginBottom: '10px',
              boxShadow: copied
                ? '0 6px 20px rgba(34,197,94,0.4)'
                : `0 6px 20px rgba(201,162,39,0.4)`,
              transition: 'all 0.25s',
            }}
          >
            {copied ? '✓ Copied!' : 'Copy URL'}
          </button>
          <button
            className="atc-btn-ghost"
            onClick={reset}
            style={{
              width: '100%', height: mobile ? '50px' : '46px', borderRadius: '12px',
              background: 'transparent', color: '#6B7280',
              border: '1.5px solid #E5E7EB', fontSize: '15px', fontWeight: '600',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
          >
            Add Another Client
          </button>
        </Card>
      </Shell>
    )
  }

  // ─── Main form ────────────────────────────────────────────────────────────
  return (
    <Shell>
      <Brand live={true} />
      <Card>
        <form onSubmit={handleAddClient}>

          {/* Search */}
          <Label>Search Business</Label>
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <div style={{
              position: 'absolute', left: '16px', top: '50%',
              transform: 'translateY(-50%)',
              color: placeSelected ? gold : '#C0C0C8',
              fontSize: '16px', pointerEvents: 'none', zIndex: 1,
              transition: 'color 0.15s',
            }}>⌕</div>
            <Input
              type="text"
              placeholder="Type a business name..."
              value={query}
              onChange={handleQueryChange}
              onFocus={() => { if (suggestions.length > 0) setShowDropdown(true) }}
              onBlur={() => {
                if (!dropdownMouseDown.current) setShowDropdown(false)
              }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              style={{
                paddingLeft: '44px',
                borderColor: placeSelected ? gold : '#E8E8EC',
                boxShadow: placeSelected ? `0 0 0 3px rgba(201,162,39,0.12)` : 'none',
                background: placeSelected ? '#FFFEF8' : '#FAFAFA',
              }}
            />

            {showDropdown && suggestions.length > 0 && (
              <div
                ref={dropdownRef}
                onMouseDown={() => { dropdownMouseDown.current = true }}
                onMouseUp={() => { dropdownMouseDown.current = false }}
                onTouchStart={() => { dropdownMouseDown.current = true }}
                style={{
                  position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                  background: '#fff', borderRadius: '14px', zIndex: 9999,
                  boxShadow: '0 16px 48px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
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
                      className="atc-drop-item"
                      onMouseDown={e => { e.preventDefault(); handleSelect(sug) }}
                      onTouchEnd={e => { e.preventDefault(); handleSelect(sug) }}
                      style={{
                        padding: mobile ? '14px 16px' : '12px 16px',
                        cursor: 'pointer',
                        borderBottom: i < suggestions.length - 1 ? '1px solid #F5F5F7' : 'none',
                        transition: 'background 0.1s',
                        minHeight: '52px',
                        display: 'flex', flexDirection: 'column', justifyContent: 'center',
                      }}
                    >
                      <div style={{ fontSize: '15px', fontWeight: '600', color: '#0D1117', lineHeight: 1.3 }}>{main}</div>
                      {secondary && (
                        <div style={{ fontSize: '13px', color: '#A0A0B0', marginTop: '2px', lineHeight: 1.3 }}>{secondary}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Status */}
          {pitchStatus === 'checking' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: '#F5F5F7', borderRadius: '12px',
              padding: '13px 16px', marginBottom: '16px',
              fontSize: '14px', color: '#9CA3AF', fontWeight: '500',
            }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%', background: '#D1D5DB',
                animation: 'pulse 1.2s ease infinite',
              }} />
              Checking visit history...
            </div>
          )}

          {pitchStatus === 'new' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: '#F0FDF4', border: '1px solid #BBF7D0',
              borderRadius: '12px', padding: '13px 16px', marginBottom: '16px',
              fontSize: '14px', color: '#15803D', fontWeight: '600',
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
              New lead — never been visited
            </div>
          )}

          {pitchStatus === 'pitched' && (
            <div style={{
              background: '#FFFBEB', border: '1px solid #FDE68A',
              borderRadius: '12px', padding: '13px 16px', marginBottom: '16px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                fontSize: '14px', color: '#92400E', fontWeight: '700',
                marginBottom: pitchHistory.length ? '12px' : 0,
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                Already visited
              </div>
              {pitchHistory.map((p, i) => (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: mobile ? '1fr 1fr' : '1fr 1.6fr 1fr',
                  gap: '4px 8px',
                  fontSize: '13px', color: '#78350F',
                  padding: '8px 0',
                  borderTop: '1px solid rgba(253,230,138,0.7)',
                }}>
                  <span style={{ fontWeight: '700' }}>{p.visited_by}</span>
                  {!mobile && <span style={{ color: '#92400E' }}>{OUTCOMES[p.outcome] || p.outcome}</span>}
                  <span style={{ color: '#A16207', textAlign: mobile ? 'right' : 'right' }}>{formatDate(p.visited_at)}</span>
                  {mobile && <span style={{ color: '#92400E', gridColumn: '1 / -1', fontSize: '12px' }}>{OUTCOMES[p.outcome] || p.outcome}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Log visit */}
          {placeSelected && (pitchStatus === 'new' || pitchStatus === 'pitched') && logStatus !== 'logged' && (
            <>
              <Divider />
              <Label>Log This Visit</Label>
              <Input
                type="text"
                placeholder="Your name"
                value={repName}
                onChange={e => setRepName(e.target.value)}
                style={{ marginBottom: '8px' }}
              />
              <div style={{ position: 'relative', marginBottom: '10px' }}>
                <select
                  className="atc-input"
                  style={{
                    ...inputBase,
                    paddingRight: '40px',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                    cursor: 'pointer',
                    color: visitOutcome ? '#0D1117' : '#9CA3AF',
                  }}
                  value={visitOutcome}
                  onChange={e => setVisitOutcome(e.target.value)}
                >
                  <option value="">Select outcome...</option>
                  <option value="pitched">Pitched — Awaiting Decision</option>
                  <option value="not_interested">Not Interested</option>
                  <option value="follow_up">Follow-Up Scheduled</option>
                  <option value="sold">Sold ✓</option>
                </select>
                <div style={{
                  position: 'absolute', right: '14px', top: '50%',
                  transform: 'translateY(-50%)', pointerEvents: 'none',
                  color: '#9CA3AF', fontSize: '12px',
                }}>▼</div>
              </div>

              <button
                type="button"
                className="atc-btn-ghost"
                style={{
                  width: '100%', height: mobile ? '50px' : '46px', borderRadius: '12px',
                  background: 'transparent', color: '#374151',
                  border: '1.5px solid #E5E7EB', fontSize: '15px', fontWeight: '600',
                  cursor: !repName.trim() || !visitOutcome ? 'not-allowed' : 'pointer',
                  opacity: !repName.trim() || !visitOutcome || logStatus === 'loading' ? 0.4 : 1,
                  transition: 'background 0.15s, opacity 0.15s',
                }}
                onClick={handleLogVisit}
                disabled={!repName.trim() || !visitOutcome || logStatus === 'loading'}
              >
                {logStatus === 'loading' ? 'Logging...' : 'Log Visit'}
              </button>

              {logStatus === 'error' && (
                <div style={{ color: '#DC2626', fontSize: '13px', marginTop: '8px', fontWeight: '500' }}>
                  Failed to log — try again.
                </div>
              )}
            </>
          )}

          {logStatus === 'logged' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              color: '#15803D', fontSize: '14px', fontWeight: '700',
              background: '#F0FDF4', borderRadius: '10px',
              padding: '11px 14px', marginTop: '4px',
              border: '1px solid #BBF7D0',
            }}>
              <span style={{
                width: '20px', height: '20px', borderRadius: '50%',
                background: '#22C55E', color: '#fff', fontSize: '11px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>✓</span>
              Visit logged successfully
            </div>
          )}

          {/* Add client */}
          {placeSelected && pitchStatus !== 'checking' && (
            <>
              <Divider />

              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '14px', color: '#15803D', fontWeight: '600',
                background: '#F0FDF4', border: '1px solid #BBF7D0',
                borderRadius: '10px', padding: '11px 14px', marginBottom: '20px',
              }}>
                <span>✓</span> {clientName} — review link ready
              </div>

              <Label>Card URL Slug</Label>
              <Input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                style={{
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  fontSize: '15px', letterSpacing: '0.3px',
                  marginBottom: '8px',
                }}
              />

              {/* URL preview */}
              <div style={{
                background: '#06091A', borderRadius: '10px',
                padding: '12px 14px', marginBottom: '20px',
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                fontSize: '13px', letterSpacing: '0.2px',
                border: '1px solid rgba(201,162,39,0.12)',
                wordBreak: 'break-all', lineHeight: 1.5,
              }}>
                <span style={{ color: 'rgba(255,255,255,0.35)' }}>{DOMAIN}/</span>
                <span style={{ color: gold, fontWeight: '700' }}>{slug || '...'}</span>
              </div>

              {submitStatus === 'error' && (
                <div style={{
                  color: '#DC2626', fontSize: '14px', marginBottom: '16px',
                  background: '#FEF2F2', borderRadius: '10px', padding: '12px 14px',
                  border: '1px solid #FECACA', fontWeight: '500',
                }}>{errorMsg}</div>
              )}

              <button
                className={canSubmit ? 'atc-btn-gold' : ''}
                type="submit"
                disabled={!canSubmit}
                style={{
                  width: '100%', height: btnH, borderRadius: '12px',
                  background: canSubmit ? goldGradient : '#F3F4F6',
                  color: canSubmit ? '#fff' : '#C0C0C0',
                  border: 'none', fontSize: '16px', fontWeight: '700',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  boxShadow: canSubmit ? `0 6px 20px rgba(201,162,39,0.4)` : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {submitStatus === 'loading' ? 'Adding...' : 'Add Client'}
              </button>
            </>
          )}

        </form>
      </Card>
    </Shell>
  )
}
