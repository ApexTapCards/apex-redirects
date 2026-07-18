'use client'

import { useState, useRef } from 'react'

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

  // ── Shared layout wrapper ─────────────────────────────────────────────────
  const Page = ({ children }) => (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(145deg, #0D1426 0%, #162050 60%, #0D1426 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      padding: '24px',
    }}>
      {/* Subtle dot pattern overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(214,174,82,0.06) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: '460px' }}>
        {/* Top brand bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '16px', padding: '0 4px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #D6AE52, #B8902A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px',
            }}>⬡</div>
            <div>
              <div style={{ color: '#fff', fontWeight: '700', fontSize: '15px', letterSpacing: '-0.3px' }}>
                Apex Tap Cards
              </div>
              <div style={{ color: '#D6AE52', fontSize: '11px', fontWeight: '500', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                Admin Portal
              </div>
            </div>
          </div>
          {authed && (
            <div style={{
              background: 'rgba(214,174,82,0.12)', border: '1px solid rgba(214,174,82,0.25)',
              borderRadius: '20px', padding: '4px 12px',
              color: '#D6AE52', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px',
            }}>LIVE</div>
          )}
        </div>
        {/* Card */}
        <div style={{
          background: '#fff',
          borderRadius: '20px',
          padding: '36px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
        }}>
          {children}
        </div>
      </div>
    </div>
  )

  const Label = ({ children }) => (
    <div style={{
      fontSize: '11px', fontWeight: '700', color: '#6B7280',
      textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '7px',
    }}>{children}</div>
  )

  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: '10px',
    border: '1.5px solid #E5E7EB', fontSize: '15px', color: '#111827',
    background: '#F9FAFB', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  const divider = (
    <div style={{ borderTop: '1px solid #F3F4F6', margin: '24px 0' }} />
  )

  const dashedDivider = (
    <div style={{ borderTop: '1px dashed #E5E7EB', margin: '20px 0' }} />
  )

  // ── Login ─────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <Page>
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#111827', letterSpacing: '-0.5px' }}>
            Sign in
          </div>
          <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>
            Enter your password to access the portal
          </div>
        </div>
        <form onSubmit={handleLogin}>
          <Label>Password</Label>
          <input
            style={{ ...inputStyle, marginBottom: '16px' }}
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
          />
          {passwordError && (
            <div style={{ color: '#DC2626', fontSize: '13px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>✕</span> {passwordError}
            </div>
          )}
          <button
            style={{
              width: '100%', padding: '13px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #D6AE52, #B8902A)',
              color: '#fff', border: 'none', fontSize: '15px', fontWeight: '700',
              cursor: 'pointer', letterSpacing: '0.2px',
            }}
            type="submit"
          >
            Sign In
          </button>
        </form>
      </Page>
    )
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (submitStatus === 'success' && result) {
    return (
      <Page>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #D6AE52, #B8902A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', margin: '0 auto 20px',
          }}>✓</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '6px' }}>
            {clientName} is live!
          </div>
          <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '28px' }}>
            Program each NFC card with this URL
          </div>
          <div style={{
            background: '#0D1426', borderRadius: '12px', padding: '16px 18px',
            fontFamily: 'monospace', fontSize: '14px', color: '#D6AE52',
            fontWeight: '600', marginBottom: '16px', wordBreak: 'break-all',
            border: '1px solid rgba(214,174,82,0.2)',
          }}>
            {result.cardUrl}
          </div>
          <button
            style={{
              width: '100%', padding: '13px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #D6AE52, #B8902A)',
              color: '#fff', border: 'none', fontSize: '14px', fontWeight: '700',
              cursor: 'pointer', marginBottom: '10px',
            }}
            onClick={() => navigator.clipboard.writeText(result.cardUrl)}
          >
            Copy URL
          </button>
          <button
            style={{
              width: '100%', padding: '12px', borderRadius: '10px',
              background: 'transparent', color: '#6B7280',
              border: '1.5px solid #E5E7EB', fontSize: '14px', fontWeight: '600',
              cursor: 'pointer',
            }}
            onClick={reset}
          >
            Add Another Client
          </button>
        </div>
      </Page>
    )
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <Page>
      <form onSubmit={handleAddClient}>

        {/* Search */}
        <Label>Search Business</Label>
        <div style={{ position: 'relative', marginBottom: '20px' }}>
          <input
            style={{
              ...inputStyle,
              borderColor: placeSelected ? '#D6AE52' : '#E5E7EB',
              paddingLeft: '42px',
            }}
            type="text"
            placeholder="Type a business name..."
            value={query}
            onChange={handleQueryChange}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          />
          {/* Search icon */}
          <div style={{
            position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
            color: '#9CA3AF', fontSize: '16px', pointerEvents: 'none',
          }}>⌕</div>

          {showDropdown && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
              background: '#fff', borderRadius: '12px', zIndex: 9999,
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '1.5px solid #E5E7EB',
              overflow: 'hidden',
            }}>
              {suggestions.map((sug, i) => {
                const pred = sug.placePrediction
                const main = pred?.structuredFormat?.mainText?.text || pred?.text?.text || ''
                const secondary = pred?.structuredFormat?.secondaryText?.text || ''
                return (
                  <div
                    key={i}
                    style={{
                      padding: '11px 16px', cursor: 'pointer',
                      borderBottom: i < suggestions.length - 1 ? '1px solid #F3F4F6' : 'none',
                    }}
                    onMouseDown={() => handleSelect(sug)}
                    onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{main}</div>
                    {secondary && (
                      <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>{secondary}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Status badges */}
        {pitchStatus === 'checking' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#F9FAFB', borderRadius: '10px', padding: '10px 14px',
            marginBottom: '16px', fontSize: '13px', color: '#6B7280',
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D1D5DB' }} />
            Checking status...
          </div>
        )}

        {pitchStatus === 'new' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px',
            padding: '10px 14px', marginBottom: '16px', fontSize: '13px',
            color: '#15803D', fontWeight: '600',
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
            New lead — never been visited
          </div>
        )}

        {pitchStatus === 'pitched' && (
          <div style={{
            background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px',
            padding: '12px 14px', marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#92400E', fontWeight: '600', marginBottom: pitchHistory.length ? '10px' : '0' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
              Already visited
            </div>
            {pitchHistory.map((p, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: '12px', color: '#78350F', padding: '6px 0',
                borderTop: i === 0 ? '1px solid #FDE68A' : 'none',
              }}>
                <span style={{ fontWeight: '600' }}>{p.visited_by}</span>
                <span style={{ color: '#92400E' }}>{OUTCOMES[p.outcome] || p.outcome}</span>
                <span style={{ color: '#A16207' }}>{formatDate(p.visited_at)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Log visit */}
        {placeSelected && (pitchStatus === 'new' || pitchStatus === 'pitched') && logStatus !== 'logged' && (
          <>
            {dashedDivider}
            <Label>Log This Visit</Label>
            <input
              style={{ ...inputStyle, marginBottom: '8px' }}
              type="text"
              placeholder="Your name"
              value={repName}
              onChange={e => setRepName(e.target.value)}
            />
            <select
              style={{ ...inputStyle, marginBottom: '8px', appearance: 'none', cursor: 'pointer' }}
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
                width: '100%', padding: '11px', borderRadius: '10px',
                background: 'transparent', color: '#374151',
                border: '1.5px solid #D1D5DB', fontSize: '14px', fontWeight: '600',
                cursor: !repName.trim() || !visitOutcome ? 'not-allowed' : 'pointer',
                opacity: !repName.trim() || !visitOutcome || logStatus === 'loading' ? 0.4 : 1,
                marginTop: '2px',
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
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            color: '#15803D', fontSize: '13px', fontWeight: '600', marginTop: '8px',
          }}>
            <span>✓</span> Visit logged
          </div>
        )}

        {/* Add client */}
        {placeSelected && pitchStatus !== 'checking' && (
          <>
            {dashedDivider}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              color: '#15803D', fontSize: '13px', fontWeight: '600', marginBottom: '18px',
            }}>
              <span>✓</span> {clientName} — review link ready
            </div>

            <Label>Card URL Slug</Label>
            <div style={{ position: 'relative', marginBottom: '6px' }}>
              <input
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '14px', paddingRight: '14px' }}
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              />
            </div>
            <div style={{
              fontSize: '12px', color: '#9CA3AF', fontFamily: 'monospace',
              marginBottom: '20px', padding: '8px 12px',
              background: '#F9FAFB', borderRadius: '8px', border: '1px solid #F3F4F6',
            }}>
              {DOMAIN}/<span style={{ color: '#D6AE52', fontWeight: '600' }}>{slug || '...'}</span>
            </div>

            {submitStatus === 'error' && (
              <div style={{
                color: '#DC2626', fontSize: '13px', marginBottom: '14px',
                background: '#FEF2F2', borderRadius: '8px', padding: '10px 12px',
                border: '1px solid #FECACA',
              }}>{errorMsg}</div>
            )}

            <button
              style={{
                width: '100%', padding: '14px', borderRadius: '10px',
                background: canSubmit
                  ? 'linear-gradient(135deg, #D6AE52, #B8902A)'
                  : '#E5E7EB',
                color: canSubmit ? '#fff' : '#9CA3AF',
                border: 'none', fontSize: '15px', fontWeight: '700',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                letterSpacing: '0.2px', transition: 'all 0.15s',
              }}
              type="submit"
              disabled={!canSubmit}
            >
              {submitStatus === 'loading' ? 'Adding...' : 'Add Client'}
            </button>
          </>
        )}

      </form>
    </Page>
  )
}
