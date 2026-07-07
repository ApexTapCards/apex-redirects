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
  const [mapsLoaded, setMapsLoaded] = useState(false)
  const [placeSelected, setPlaceSelected] = useState(false)
  const autocompleteContainerRef = useRef(null)

  const slug = useCustomSlug ? customSlug : toSlug(clientName)
  const cardUrl = `https://${DOMAIN}/${slug}`

  useEffect(() => {
    if (!authed) return
    if (window.google?.maps) { setMapsLoaded(true); return }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&loading=async&libraries=places&v=weekly`
    script.async = true
    script.onload = () => setMapsLoaded(true)
    document.head.appendChild(script)
  }, [authed])

  useEffect(() => {
    if (!mapsLoaded || !autocompleteContainerRef.current) return
    ;(async () => {
      try {
        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary('places')
        autocompleteContainerRef.current.innerHTML = ''
        const placeAuto = new PlaceAutocompleteElement()
        placeAuto.style.width = '100%'
        placeAuto.style.display = 'block'
        autocompleteContainerRef.current.appendChild(placeAuto)
        placeAuto.addEventListener('gmp-select', async (event) => {
          const place = event.placePrediction.toPlace()
          await place.fetchFields({ fields: ['displayName', 'id'] })
          setClientName(place.displayName || '')
          setGoogleUrl(`https://search.google.com/local/writereview?placeid=${place.id}`)
          setPlaceSelected(true)
          setUseCustomSlug(false)
        })
      } catch (err) { console.error('Places init error:', err) }
    })()
  }, [mapsLoaded])

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
      setClientName(''); setGoogleUrl(''); setCustomSlug(''); setUseCustomSlug(false); setPlaceSelected(false)
      if (autocompleteContainerRef.current) { const input = autocompleteContainerRef.current.querySelector('input'); if (input) input.value = '' }
    } else { setStatus('error'); setErrorMsg(data.error || 'Something went wrong.') }
  }

  function reset() { setStatus(null); setResult(null); setErrorMsg(''); setPlaceSelected(false) }

  const s = {
    page: { minHeight: '100vh', background: '#F2ECE0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '24px' },
    card: { background: '#fff', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '440px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
    logo: { fontSize: '22px', fontWeight: '700', color: '#16181A', marginBottom: '4px', letterSpacing: '-0.5px' },
    sub: { fontSize: '13px', color: '#8C6937', marginBottom: '32px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' },
    label: { display: 'block', fontSize: '12px', fontWeight: '600', color: '#16181A', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' },
    input: { width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #E5DFD3', fontSize: '15px', color: '#16181A', background: '#FAFAF8', outline: 'none', boxSizing: 'border-box', marginBottom: '20px' },
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
  }

  if (!authed) return (
    <div style={s.page}><div style={s.card}>
      <div style={s.logo}>Apex Tap Cards</div>
      <div style={s.sub}>Admin — Add Client</div>
      <form onSubmit={handleLogin}>
        <label style={s.label}>Password</label>
        <input style={s.input} type="password" placeholder="Enter admin password" value={password} onChange={e => setPassword(e.target.value)} autoFocus />
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
        <div ref={autocompleteContainerRef} style={{ marginBottom: '8px' }} />
        {!mapsLoaded && <input style={s.input} type="text" placeholder="Loading search..." disabled />}
        {placeSelected && <div style={s.confirmed}>✓ {clientName} — review link ready</div>}
        {slug && <>
          <div style={s.hint}>Card URL preview:</div>
          <div style={s.preview}>{DOMAIN}/{slug}</div>
          {!useCustomSlug && <span style={s.toggleLink} onClick={() => { setUseCustomSlug(true); setCustomSlug(slug) }}>Edit URL slug</span>}
        </>}
        {useCustomSlug && <>
          <label style={s.label}>URL Slug</label>
          <input style={s.input} type="text" placeholder="marios-pizza" value={customSlug} onChange={e => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
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
