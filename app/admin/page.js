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

// Extract city from full Google Places text e.g. "Salutes, Val Caron, ON, Canada"
function extractCity(fullText, businessName) {
  let text = fullText || ''
  // Strip the business name from the front
  if (businessName && text.toLowerCase().startsWith(businessName.toLowerCase())) {
    text = text.slice(businessName.length).replace(/^[,\s]+/, '')
  }
  // text is now e.g. "Val Caron, ON, Canada" or "123 Main St, Val Caron, ON, Canada"
  const parts = text.split(',').map(p => p.trim()).filter(Boolean)
  // Find the province code (2 uppercase letters like "ON", "QC")
  const provIdx = parts.findIndex(p => /^[A-Z]{2}(\s|$)/.test(p))
  const limit = provIdx > 0 ? provIdx : parts.length
  // Return first part that doesn't start with a digit (skip street numbers)
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
  // Auth
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // Search
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [placeSelected, setPlaceSelected] = useState(false)

  // Selected business
  const [clientName, setClientName] = useState('')
  const [googleUrl, setGoogleUrl] = useState('')
  const [placeId, setPlaceId] = useState('')
  const [slug, setSlug] = useState('')

  // Pitch tracking
  const [pitchStatus, setPitchStatus] = useState(null)
  const [pitchHistory, setPitchHistory] = useState([])
  const [repName, setRepName] = useState('')
  const [visitOutcome, setVisitOutcome] = useState('')
  const [logStatus, setLogStatus] = useState(null)

  // Add client
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
      } else {
        setLogStatus('error')
      }
    } catch {
      setLogStatus('error')
    }
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

  const s = {
    page: { minHeight: '100vh', background: '#F2ECE0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '24px' },
    card: { background: '#fff', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '440px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
    logo: { fontSize: '22px', fontWeight: '700', color: '#16181A', marginBottom: '4px', letterSpacing: '-0.5px' },
    sub: { fontSize: '13px', color: '#8C6937', marginBottom: '32px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' },
    label: { display: 'block', fontSize: '12px', fontWeight: '600', color: '#16181A', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' },
    input: { width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #E5DFD3', fontSize: '15px', color: '#16181A', background: '#FAFAF8', outline: 'none', boxSizing: 'border-box' },
    select: { width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #E5DFD3', fontSize: '15px', color: '#16181A', background: '#FAFAF8', outline: 'none', boxSizing: 'border-box' },
    btn: { width: '100%', padding: '14px', background: '#16181A', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' },
    logBtn: { width: '100%', padding: '11px', background: '#F2ECE0', color: '#16181A', border: '1.5px solid #E5DFD3', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginTop: '8px' },
    error: { color: '#c0392b', fontSize: '13px', marginBottom: '12px' },
    hint: { fontSize: '12px', color: '#6B7280', marginBottom: '6px' },
    confirmed: { fontSize: '12px', color: '#8C6937', fontWeight: '600', marginBottom: '16px' },
    divider: { border: 'none', borderTop: '1px solid #E5DFD3', marginBottom: '24px' },
    sectionDivider: { border: 'none', borderTop: '1px dashed #E5DFD3', margin: '20px 0' },
    urlBox: { background: '#16181A', color: '#F2ECE0', borderRadius: '8px', padding: '14px 16px', fontSize: '14px', fontFamily: 'monospace', fontWeight: '600', marginBottom: '16px', wordBreak: 'break-all' },
    urlLabel: { fontSize: '11px', color: '#8C6937', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' },
    copyBtn: { width: '100%', padding: '12px', background: '#8C6937', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginBottom: '12px' },
    anotherBtn: { width: '100%', padding: '12px', background: 'transparent', color: '#16181A', border: '1.5px solid #E5DFD3', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
    dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid #E5DFD3', borderRadius: '8px', zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', marginTop: '4px', overflow: 'hidden' },
    dropdownItem: { padding: '11px 14px', cursor: 'pointer', fontSize: '14px', color: '#16181A' },
    statusNew: { background: '#ECFDF5', border: '1.5px solid #6EE7B7', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#065F46', fontWeight: '600', marginBottom: '16px' },
    statusPitched: { background: '#FFFBEB', border: '1.5px solid #FCD34D', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#92400E', fontWeight: '600', marginBottom: '8px' },
    statusChecking: { background: '#F3F4F6', border: '1.5px solid #D1D5DB', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#6B7280', marginBottom: '16px' },
    pitchRecord: { fontSize: '12px', color: '#78350F', fontWeight: '400', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #FDE68A' },
    slugPreview: { fontSize: '12px', color: '#8C6937', fontFamily: 'monospace', marginBottom: '16px' },
  }

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={s.page}><div style={s.card}>
        <div style={s.logo}>Apex Tap Cards</div>
        <div style={s.sub}>Admin Portal</div>
        <form onSubmit={handleLogin}>
          <label style={s.label}>Password</label>
          <input
            style={{ ...s.input, marginBottom: '20px' }}
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
          />
          {passwordError && <div style={s.error}>{passwordError}</div>}
          <button style={s.btn} type="submit">Sign In</button>
        </form>
      </div></div>
    )
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitStatus === 'success' && result) {
    return (
      <div style={s.page}><div style={s.card}>
        <div style={s.logo}>Apex Tap Cards</div>
        <div style={s.sub}>Client Added</div>
        <hr style={s.divider} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#16181A', marginBottom: '8px' }}>
            {clientName} is live!
          </div>
          <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px' }}>
            Program each NFC card with this URL:
          </div>
          <div style={s.urlLabel}>Card URL</div>
          <div style={s.urlBox}>{result.cardUrl}</div>
          <button style={s.copyBtn} onClick={() => navigator.clipboard.writeText(result.cardUrl)}>
            Copy URL
          </button>
          <button style={s.anotherBtn} onClick={reset}>Add Another Client</button>
        </div>
      </div></div>
    )
  }

  const canSubmit = placeSelected && slug.trim() && pitchStatus !== 'checking' && submitStatus !== 'loading'

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div style={s.page}><div style={s.card}>
      <div style={s.logo}>Apex Tap Cards</div>
      <div style={s.sub}>Admin — Add Client</div>
      <hr style={s.divider} />
      <form onSubmit={handleAddClient}>

        {/* STEP 1: Search */}
        <label style={s.label}>Search Business</label>
        <div style={{ position: 'relative', marginBottom: '20px' }}>
          <input
            style={{ ...s.input, borderColor: placeSelected ? '#8C6937' : '#E5DFD3' }}
            type="text"
            placeholder="Type business name..."
            value={query}
            onChange={handleQueryChange}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          />
          {showDropdown && suggestions.length > 0 && (
            <div style={s.dropdown}>
              {suggestions.map((sug, i) => {
                const pred = sug.placePrediction
                const main = pred?.structuredFormat?.mainText?.text || pred?.text?.text || ''
                const secondary = pred?.structuredFormat?.secondaryText?.text || ''
                return (
                  <div
                    key={i}
                    style={{
                      ...s.dropdownItem,
                      borderBottom: i < suggestions.length - 1 ? '1px solid #F2ECE0' : 'none',
                    }}
                    onMouseDown={() => handleSelect(sug)}
                  >
                    <div>{main}</div>
                    {secondary && (
                      <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>{secondary}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pitch status */}
        {pitchStatus === 'checking' && (
          <div style={s.statusChecking}>Checking status...</div>
        )}
        {pitchStatus === 'new' && (
          <div style={s.statusNew}>🟢 New lead — never been visited</div>
        )}
        {pitchStatus === 'pitched' && (
          <div style={{ marginBottom: '16px' }}>
            <div style={s.statusPitched}>
              🟡 Already visited
              {pitchHistory.map((p, i) => (
                <div key={i} style={s.pitchRecord}>
                  {p.visited_by} · {formatDate(p.visited_at)} · {OUTCOMES[p.outcome] || p.outcome}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Log visit */}
        {placeSelected && (pitchStatus === 'new' || pitchStatus === 'pitched') && logStatus !== 'logged' && (
          <>
            <hr style={s.sectionDivider} />
            <label style={s.label}>Log This Visit</label>
            <input
              style={{ ...s.input, marginBottom: '8px' }}
              type="text"
              placeholder="Your name"
              value={repName}
              onChange={e => setRepName(e.target.value)}
            />
            <select
              style={{ ...s.select, marginBottom: '8px' }}
              value={visitOutcome}
              onChange={e => setVisitOutcome(e.target.value)}
            >
              <option value="">Select outcome</option>
              <option value="pitched">Pitched — Awaiting Decision</option>
              <option value="not_interested">Not Interested</option>
              <option value="follow_up">Follow-Up Scheduled</option>
              <option value="sold">Sold</option>
            </select>
            <button
              type="button"
              style={{
                ...s.logBtn,
                opacity: !repName.trim() || !visitOutcome || logStatus === 'loading' ? 0.4 : 1,
                cursor: !repName.trim() || !visitOutcome ? 'not-allowed' : 'pointer',
              }}
              onClick={handleLogVisit}
              disabled={!repName.trim() || !visitOutcome || logStatus === 'loading'}
            >
              {logStatus === 'loading' ? 'Logging...' : 'Log Visit'}
            </button>
            {logStatus === 'error' && <div style={{ ...s.error, marginTop: '8px' }}>Failed to log — try again.</div>}
          </>
        )}
        {logStatus === 'logged' && (
          <div style={{ ...s.confirmed, marginTop: '8px' }}>✓ Visit logged</div>
        )}

        {/* Add client */}
        {placeSelected && pitchStatus !== 'checking' && (
          <>
            <hr style={s.sectionDivider} />
            <div style={s.confirmed}>✓ {clientName} — review link ready</div>

            <label style={s.label}>Card URL Slug</label>
            <input
              style={{ ...s.input, marginBottom: '6px', fontFamily: 'monospace' }}
              type="text"
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            />
            <div style={s.slugPreview}>{DOMAIN}/{slug || '...'}</div>

            {submitStatus === 'error' && <div style={s.error}>{errorMsg}</div>}

            <button
              style={{
                ...s.btn,
                opacity: !canSubmit ? 0.4 : 1,
                cursor: !canSubmit ? 'not-allowed' : 'pointer',
              }}
              type="submit"
              disabled={!canSubmit}
            >
              {submitStatus === 'loading' ? 'Adding...' : 'Add Client'}
            </button>
          </>
        )}

      </form>
    </div></div>
  )
}
