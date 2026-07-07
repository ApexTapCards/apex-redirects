'use client'

import { useState, useEffect, useRef } from 'react'

const DOMAIN = 'go.apextapcards.com'

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [clientName, setClientName] = useState('')
  const [googleUrl, setGoogleUrl] = useState('')
  const [customSlug, setCustomSlug] = useState('')
  const [useCustomSlug, setUseCustomSlug] = useState(false)
  const [status, setStatus] = useState(null)
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [mapsReady, setMapsReady] = useState(false)
  const [placeSelected, setPlaceSelected] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const acRef = useRef(null)
  const debounceRef = useRef(null)

  const slug = useCustomSlug ? customSlug : toSlug(clientName)
  const cardUrl = `https://${DOMAIN}/${slug}`

  useEffect(() => {
    if (!authed) return
    if (window.__mapsLoaded) { setMapsReady(true); return }
    window.__onMapsReady = () => { window.__mapsLoaded = true; setMapsReady(true) }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&v=weekly&callback=__onMapsReady`
    script.async = true
    document.head.appendChild(script)
  }, [authed])

  useEffect(() => {
    if (!mapsReady) return
    ;(async () => {
      try {
        const { AutocompleteSuggestion } = await window.google.maps.importLibrary('places')
        acRef.current = AutocompleteSuggestion
      } catch (err) { console.error('Places load error:', err) }
    })()
  }, [mapsReady])

  useEffect(() => {
    if (!acRef.current || query.length < 2) { setSuggestions([]); setShowDropdown(false); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const { suggestions: s } = await acRef.current.fetchAutocompleteSuggestions({
          input: query,
          includedPrimaryTypes: ['establishment'],
        })
        setSuggestions(s || [])
        setShowDropdown(true)
      } catch (err) { console.error('Suggestions error:', err) }
    }, 300)
  }, [query])

  async function handleSelect(suggestion) {
    try {
      const place = suggestion.placePrediction.toPlace()
      await place.fetchFields({ fields: ['displayName', 'id'] })
      const name = place.displayName || ''
      setClientName(name)
      setGoogleUrl(`https://search.google.com/local/writereview?placeid=${place.id}`)
      setQuery(name)
      setPlaceSelected(true)
      setSuggestions([])
      setShowDropdown(false)
      setUseCustomSlug(false)
    } catch (err) { console.error('Select error:', err) }
  }

  async function handleLogin(e) {
    e.preventDefault()
    const res = await fetch('/api/admin-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
    if (res.ok) { setAuthed(true); setPasswordError('') } else { setPasswordError('Incorrect password.') }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!clientName || !googleUrl || !slug) return
    setStatus('loading'); setErrorMsg('')
    const res = await fetch('/api/add-client', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, client_name: clientName, google_url: googleUrl, password }) })
    const data = await res.json()
    if (res.ok) {
      setStatus('success'); setResult({ slug, cardUrl })
      setClientName(''); setGoogleUrl(''); setCustomSlug(''); setUseCustomSlug(false)
      setPlaceSelected(false); setQuery(''); setSuggestions([])
    } else {
      setStatus('error'); setErrorMsg(data.error || 'Something went wrong.')
    }
  }

  function reset() { setStatus(null); setResult(null); setErrorMsg(''); setPlaceSelected(false) }

  const s = {
    page: { minHeight: '100vh', background: '#F2ECE0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '24px' },
    card: { background: '#fff', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '440px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
    logo: { fontSize: '22px', fontWeight: '700', color: '#16181A', marginBottom: '4px', letterSpacing: '-0.5px' },
    sub: { fontSize: '13px', color: '#8C6937', marginBottom: '32px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' },
    label: { display: 'block', fontSize: '12px', fontWeight: '600', color: '#16181A', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' },
    input: { width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #E5DFD3', fontSize: '15px', color: '#16181A', background: '#FAFAF8', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' },
    preview: { background: '#F2ECE0', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#8C6937', fontWeight: '600', marginBottom: '20px', fontFamily: 'monospace', wordBreak: 'break-all' },
    btn: { width: '100%', padding: '14px', background: '#16181A', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' },
    btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
    error: { color: '#c0392b', fontSize: '13px', marginBottom: '16px' },
    hint: { fontSize: '12px', color: '#6B7280', marginBottom: '6px' },
    confirmed: { fontSize: '12px', color: '#8C6937', fontWeight: '600', marginBottom: '20px' },
    toggleLink: { fontSize: '12px', color: '#8C6937', cursor: 'pointer', textDecoration: 'underline', display: 'inline-block', marginBottom: '20px' },
    divider: { border: 'none', borderTop: '1px solid #E5DFD3', marginBottom: '24px' },
    urlBox: { background: '#16181A', color: '#F2ECE0', borderRadius: '8px', padding: '14px 16px', fontSize: '14px', fontFamily: 'monospace', fontWeight: '600', marginBottom: '16px', wordBreak: 'break-all', textAlign: 'left' },
    urlLabel: { fontSize: '11px', color: '#8C6937', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' },
    copyBtn: { width: '100%', padding: '12px', background: '#8C6937', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginBottom: '12px' },
    anotherBtn: { width: '100%', padding: '12px', background: 'transparent', color: '#16181A', border: '1.5px solid #E5DFD3', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
    dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid #E5DFD3', borderRadius: '8px', zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', marginTop: '4px', overflow: 'hidden' },
    dropdownItem: { padding: '11px 14px', cursor: 'pointer', fontSize: '14px', color: '#16181A' },
  }

  if (!authed) return (
    <div style={s.page}><div style={s.card}>
      <div style={s.logo}>Apex Tap Cards</div>
      <div style={s.sub}>Admin — Add Client</div>
      <form onSubmit={handleLogin}>
        <label style={s.label}>Password</label>
        <input style={{ ...s.input, marginBottom: '20px' }} type="password" placeholder="Enter admin password" value={password} onChange={e => setPassword(e.target.value)} autoFocus />
        {passwordError && <div style={s.error}>{passwordError}</div>}
        <button style={s.btn} type="submit">Sign In</button>
      </form>
    </div></div>
  )

  if (status === 'success' && result) return (
    <div style={s.page}><div style={s.card}>
      <div style={s.logo}>Apex Tap Cards</div>
      <div style={s.sub}>Admin — Add Client</div>
      <hr style={s.divider} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
        <div style={{ fontSize: '18px', fontWeight: '700', color: '#16181A', marginBottom: '8px' }}>Client added!</div>
        <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px' }}>Program each NFC card with this URL:</div>
        <div style={s.urlLabel}>Card URL</div>
        <div style={s.urlBox}>{result.cardUrl}</div>
        <button style={s.copyBtn} onClick={() => navigator.clipboard.writeText(result.cardUrl)}>Copy URL</button>
        <button style={s.anotherBtn} onClick={reset}>Add Another Client</button>
      </div>
    </div></div>
  )

  const isReady = clientName.trim() && googleUrl.trim() && slug.trim()

  return (
    <div style={s.page}><div style={s.card}>
      <div style={s.logo}>Apex Tap Cards</div>
      <div style={s.sub}>Admin — Add Client</div>
      <hr style={s.divider} />
      <form onSubmit={handleSubmit}>
        <label style={s.label}>Search Business</label>
        <div style={{ position: 'relative', marginBottom: '20px' }}>
          <input
            style={{ ...s.input, borderColor: placeSelected ? '#8C6937' : '#E5DFD3' }}
            type="text"
            placeholder={mapsReady ? 'Type business name...' : 'Loading...'}
            value={query}
            disabled={!mapsReady}
            onChange={e => { setQuery(e.target.value); setPlaceSelected(false); setClientName(''); setGoogleUrl('') }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          />
          {showDropdown && suggestions.length > 0 && (
            <div style={s.dropdown}>
              {suggestions.map((sug, i) => (
                <div
                  key={i}
                  style={{ ...s.dropdownItem, borderBottom: i < suggestions.length - 1 ? '1px solid #F2ECE0' : 'none' }}
                  onMouseDown={() => handleSelect(sug)}
                >
                  {sug.placePrediction?.mainText?.toString() || sug.placePrediction?.text?.toString() || ''}
                  {sug.placePrediction?.secondaryText && (
                    <span style={{ fontSize: '12px', color: '#9CA3AF', marginLeft: '6px' }}>
                      {sug.placePrediction.secondaryText.toString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {placeSelected && <div style={s.confirmed}>✓ {clientName} — review link ready</div>}

        {slug && <>
          <div style={s.hint}>Card URL preview:</div>
          <div style={s.preview}>{DOMAIN}/{slug}</div>
          {!useCustomSlug && <span style={s.toggleLink} onClick={() => { setUseCustomSlug(true); setCustomSlug(slug) }}>Edit URL slug</span>}
        </>}

        {useCustomSlug && <>
          <label style={s.label}>URL Slug</label>
          <input style={{ ...s.input, marginBottom: '8px' }} type="text" placeholder="marios-pizza" value={customSlug} onChange={e => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
          <div style={s.preview}>{DOMAIN}/{customSlug || '...'}</div>
        </>}

        {status === 'error' && <div style={s.error}>{errorMsg}</div>}

        <button style={{ ...s.btn, ...(!isReady || status === 'loading' ? s.btnDisabled : {}) }} type="submit" disabled={!isReady || status === 'loading'}>
          {status === 'loading' ? 'Adding...' : 'Add Client'}
        </button>
      </form>
    </div></div>
  )
}
