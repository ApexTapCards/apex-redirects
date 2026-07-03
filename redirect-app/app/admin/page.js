'use client'

import { useState } from 'react'

const DOMAIN = 'go.apextapcards.com'

function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [clientName, setClientName] = useState('')
  const [googleUrl, setGoogleUrl] = useState('')
  const [customSlug, setCustomSlug] = useState('')
  const [useCustomSlug, setUseCustomSlug] = useState(false)
  const [status, setStatus] = useState(null) // null | 'loading' | 'success' | 'error'
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const slug = useCustomSlug ? customSlug : toSlug(clientName)
  const cardUrl = `https://${DOMAIN}/${slug}`

  async function handleLogin(e) {
    e.preventDefault()
    const res = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      setAuthed(true)
      setPasswordError('')
    } else {
      setPasswordError('Incorrect password.')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!clientName || !googleUrl || !slug) return
    setStatus('loading')
    setErrorMsg('')

    const res = await fetch('/api/add-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        client_name: clientName,
        google_url: googleUrl,
        password,
      }),
    })

    const data = await res.json()
    if (res.ok) {
      setStatus('success')
      setResult({ slug, cardUrl })
      setClientName('')
      setGoogleUrl('')
      setCustomSlug('')
      setUseCustomSlug(false)
    } else {
      setStatus('error')
      setErrorMsg(data.error || 'Something went wrong.')
    }
  }

  function reset() {
    setStatus(null)
    setResult(null)
    setErrorMsg('')
  }

  const styles = {
    page: {
      minHeight: '100vh',
      background: '#F2ECE0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '24px',
    },
    card: {
      background: '#fff',
      borderRadius: '16px',
      padding: '40px',
      width: '100%',
      maxWidth: '440px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    },
    logo: {
      fontSize: '22px',
      fontWeight: '700',
      color: '#16181A',
      marginBottom: '4px',
      letterSpacing: '-0.5px',
    },
    sub: {
      fontSize: '13px',
      color: '#8C6937',
      marginBottom: '32px',
      fontWeight: '500',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
    label: {
      display: 'block',
      fontSize: '12px',
      fontWeight: '600',
      color: '#16181A',
      marginBottom: '6px',
      textTransform: 'uppercase',
      letterSpacing: '0.4px',
    },
    input: {
      width: '100%',
      padding: '12px 14px',
      borderRadius: '8px',
      border: '1.5px solid #E5DFD3',
      fontSize: '15px',
      color: '#16181A',
      background: '#FAFAF8',
      outline: 'none',
      boxSizing: 'border-box',
      marginBottom: '20px',
      transition: 'border-color 0.15s',
    },
    preview: {
      background: '#F2ECE0',
      borderRadius: '8px',
      padding: '12px 14px',
      fontSize: '13px',
      color: '#8C6937',
      fontWeight: '600',
      marginBottom: '20px',
      fontFamily: 'monospace',
      wordBreak: 'break-all',
    },
    btn: {
      width: '100%',
      padding: '14px',
      background: '#16181A',
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      fontSize: '15px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'opacity 0.15s',
    },
    btnDisabled: {
      opacity: 0.4,
      cursor: 'not-allowed',
    },
    error: {
      color: '#c0392b',
      fontSize: '13px',
      marginBottom: '16px',
    },
    success: {
      textAlign: 'center',
    },
    checkmark: {
      fontSize: '48px',
      marginBottom: '16px',
    },
    successTitle: {
      fontSize: '18px',
      fontWeight: '700',
      color: '#16181A',
      marginBottom: '8px',
    },
    successSub: {
      fontSize: '13px',
      color: '#6B7280',
      marginBottom: '24px',
    },
    urlBox: {
      background: '#16181A',
      color: '#F2ECE0',
      borderRadius: '8px',
      padding: '14px 16px',
      fontSize: '14px',
      fontFamily: 'monospace',
      fontWeight: '600',
      marginBottom: '16px',
      wordBreak: 'break-all',
      textAlign: 'left',
    },
    urlLabel: {
      fontSize: '11px',
      color: '#8C6937',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginBottom: '6px',
    },
    copyBtn: {
      width: '100%',
      padding: '12px',
      background: '#8C6937',
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      marginBottom: '12px',
    },
    anotherBtn: {
      width: '100%',
      padding: '12px',
      background: 'transparent',
      color: '#16181A',
      border: '1.5px solid #E5DFD3',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
    },
    toggleLink: {
      fontSize: '12px',
      color: '#8C6937',
      cursor: 'pointer',
      textDecoration: 'underline',
      display: 'inline-block',
      marginBottom: '20px',
      marginTop: '-14px',
    },
    divider: {
      border: 'none',
      borderTop: '1px solid #E5DFD3',
      marginBottom: '24px',
    },
  }

  if (!authed) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>Apex Tap Cards</div>
          <div style={styles.sub}>Admin — Add Client</div>
          <form onSubmit={handleLogin}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
            {passwordError && <div style={styles.error}>{passwordError}</div>}
            <button style={styles.btn} type="submit">
              Sign In
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (status === 'success' && result) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>Apex Tap Cards</div>
          <div style={styles.sub}>Admin — Add Client</div>
          <hr style={styles.divider} />
          <div style={styles.success}>
            <div style={styles.checkmark}>✓</div>
            <div style={styles.successTitle}>Client added!</div>
            <div style={styles.successSub}>Program each NFC card with this URL:</div>
            <div style={styles.urlLabel}>Card URL</div>
            <div style={styles.urlBox}>{result.cardUrl}</div>
            <button
              style={styles.copyBtn}
              onClick={() => {
                navigator.clipboard.writeText(result.cardUrl)
              }}
            >
              Copy URL
            </button>
            <button style={styles.anotherBtn} onClick={reset}>
              Add Another Client
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isReady = clientName.trim() && googleUrl.trim() && slug.trim()

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>Apex Tap Cards</div>
        <div style={styles.sub}>Admin — Add Client</div>
        <hr style={styles.divider} />
        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Client Business Name</label>
          <input
            style={styles.input}
            type="text"
            placeholder="e.g. Mario's Pizza"
            value={clientName}
            onChange={e => {
              setClientName(e.target.value)
              if (useCustomSlug) setCustomSlug(toSlug(e.target.value))
            }}
            autoFocus
          />

          {!useCustomSlug && slug && (
            <>
              <div style={{ marginTop: '-14px', marginBottom: '6px', fontSize: '12px', color: '#6B7280' }}>
                Card URL preview:
              </div>
              <div style={styles.preview}>{DOMAIN}/{slug}</div>
              <span
                style={styles.toggleLink}
                onClick={() => {
                  setUseCustomSlug(true)
                  setCustomSlug(slug)
                }}
              >
                Edit URL slug
              </span>
            </>
          )}

          {useCustomSlug && (
            <>
              <label style={styles.label}>URL Slug</label>
              <input
                style={styles.input}
                type="text"
                placeholder="marios-pizza"
                value={customSlug}
                onChange={e => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              />
              <div style={styles.preview}>{DOMAIN}/{customSlug || '...'}</div>
            </>
          )}

          <label style={styles.label}>Google Review Link</label>
          <input
            style={styles.input}
            type="url"
            placeholder="https://g.page/r/..."
            value={googleUrl}
            onChange={e => setGoogleUrl(e.target.value)}
          />

          {status === 'error' && <div style={styles.error}>{errorMsg}</div>}

          <button
            style={{ ...styles.btn, ...(isReady && status !== 'loading' ? {} : styles.btnDisabled) }}
            type="submit"
            disabled={!isReady || status === 'loading'}
          >
            {status === 'loading' ? 'Adding...' : 'Add Client'}
          </button>
        </form>
      </div>
    </div>
  )
}
