'use client'

import { useState, useRef } from 'react'

const DOMAIN = 'go.apextapcards.com'
const GOLD   = '#C4A535'
const NAVY   = '#09101F'

const OUTCOMES = {
  pitched:      'Pitched — Awaiting Decision',
  not_interested:'Not Interested',
  follow_up:    'Follow-Up Scheduled',
  sold:         'Sold',
}

function toSlug(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-')
}

function extractCity(full, name) {
  let t = full || ''
  if (name && t.toLowerCase().startsWith(name.toLowerCase()))
    t = t.slice(name.length).replace(/^[,\s]+/,'')
  const parts = t.split(',').map(p=>p.trim()).filter(Boolean)
  const pi = parts.findIndex(p=>/^[A-Z]{2}(\s|$)/.test(p))
  const lim = pi > 0 ? pi : parts.length
  for (let i=0;i<lim;i++) if (parts[i] && !/^\d/.test(parts[i])) return parts[i]
  return ''
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'})
}

/* ─── tiny shared components ─────────────────────────────────────────────── */

const inp = {
  display:'block', width:'100%', height:50, padding:'0 14px',
  borderRadius:12, border:'1.5px solid #E4E4EC',
  fontSize:16, color:'#111', background:'#F8F8FB',
  boxSizing:'border-box', fontFamily:'inherit',
  outline:'none', WebkitAppearance:'none', appearance:'none',
}

function Input(props) {
  return <input className="i" style={inp} {...props} />
}

function Btn({ gold, disabled, children, ...rest }) {
  return (
    <button
      style={{
        width:'100%', height:52, borderRadius:13, border:'none',
        background: disabled ? '#EDEDF0'
                  : gold     ? `linear-gradient(135deg,#D4AA40,#8A6800)`
                  :            'transparent',
        color: disabled ? '#B8B8C0' : gold ? '#fff' : '#555',
        border: (!gold && !disabled) ? '1.5px solid #DDDDE8' : 'none',
        fontSize:16, fontWeight:700, cursor: disabled ? 'not-allowed':'pointer',
        boxShadow: (gold && !disabled) ? '0 4px 16px rgba(196,165,53,.38)' : 'none',
        fontFamily:'inherit', transition:'opacity .15s',
      }}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  )
}

function Label({ children }) {
  return (
    <div style={{fontSize:11,fontWeight:700,color:'#909098',
      textTransform:'uppercase',letterSpacing:'1px',marginBottom:7}}>
      {children}
    </div>
  )
}

function StatusPill({ color, bg, border, dot, children }) {
  return (
    <div style={{
      display:'flex',alignItems:'center',gap:9,
      background:bg, border:`1px solid ${border}`,
      borderRadius:12,padding:'12px 14px',
      fontSize:14,color,fontWeight:600,marginBottom:16,
    }}>
      <div style={{width:8,height:8,borderRadius:'50%',background:dot,flexShrink:0}}/>
      {children}
    </div>
  )
}

/* ─── page ────────────────────────────────────────────────────────────────── */

export default function AdminPage() {
  const [authed,setAuthed]   = useState(false)
  const [pw,setPw]           = useState('')
  const [pwErr,setPwErr]     = useState('')

  const [query,setQuery]     = useState('')
  const [sugs,setSugs]       = useState([])
  const [drop,setDrop]       = useState(false)
  const [picked,setPicked]   = useState(false)

  const [name,setName]       = useState('')
  const [gUrl,setGUrl]       = useState('')
  const [pid,setPid]         = useState('')
  const [slug,setSlug]       = useState('')

  const [pStatus,setPStatus] = useState(null)
  const [history,setHistory] = useState([])
  const [rep,setRep]         = useState('')
  const [outcome,setOutcome] = useState('')
  const [logSt,setLogSt]     = useState(null)

  const [addSt,setAddSt]     = useState(null)
  const [addErr,setAddErr]   = useState('')
  const [result,setResult]   = useState(null)
  const [copied,setCopied]   = useState(false)

  const dbc    = useRef(null)
  const inDrop = useRef(false)

  async function fetchSugs(v) {
    if (v.length<2){setSugs([]);setDrop(false);return}
    try {
      const r = await fetch('https://places.googleapis.com/v1/places:autocomplete',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-Goog-Api-Key':process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY},
        body:JSON.stringify({input:v,includedPrimaryTypes:['establishment']}),
      })
      const d = await r.json()
      const list = d.suggestions||[]
      setSugs(list); setDrop(list.length>0)
    } catch{}
  }

  function onQ(e) {
    const v=e.target.value; setQuery(v); setPicked(false)
    setName('');setGUrl('');setPid('');setSlug('')
    setPStatus(null);setHistory([]);setLogSt(null)
    setAddSt(null);setAddErr('')
    clearTimeout(dbc.current)
    dbc.current=setTimeout(()=>fetchSugs(v),300)
  }

  function pick(sug) {
    const pred=sug.placePrediction
    const n=pred?.structuredFormat?.mainText?.text||pred?.text?.text||''
    const id=pred?.placeId||''
    const full=pred?.text?.text||''
    const city=extractCity(full,n)
    const auto=city?toSlug(n)+'-'+toSlug(city):toSlug(n)
    setName(n); setGUrl(`https://search.google.com/local/writereview?placeid=${id}`)
    setPid(id); setSlug(auto); setQuery(n); setPicked(true)
    setSugs([]); setDrop(false)
    setHistory([]);setLogSt(null);setOutcome('');setAddSt(null);setAddErr('')
    checkPitch(id)
  }

  async function checkPitch(id) {
    setPStatus('checking')
    try {
      const r=await fetch(`/api/check-pitch?placeId=${encodeURIComponent(id)}`)
      const d=await r.json()
      setPStatus(d.status)
      if(d.pitches) setHistory(d.pitches)
    } catch { setPStatus('new') }
  }

  async function logVisit() {
    if(!rep.trim()||!outcome) return
    setLogSt('loading')
    try {
      const r=await fetch('/api/log-pitch',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({place_id:pid,business_name:name,visited_by:rep.trim(),outcome,password:pw}),
      })
      if(r.ok){
        setLogSt('logged')
        setHistory(prev=>[{visited_by:rep.trim(),outcome,visited_at:new Date().toISOString()},...prev])
        if(pStatus==='new') setPStatus('pitched')
      } else setLogSt('error')
    } catch {setLogSt('error')}
  }

  async function login(e) {
    e.preventDefault()
    const r=await fetch('/api/admin-auth',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({password:pw}),
    })
    if(r.ok){setAuthed(true);setPwErr('')} else setPwErr('Incorrect password.')
  }

  async function addClient(e) {
    e.preventDefault()
    if(!name||!gUrl||!slug) return
    setAddSt('loading');setAddErr('')
    const r=await fetch('/api/add-client',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({slug,client_name:name,google_url:gUrl,password:pw}),
    })
    const d=await r.json()
    if(r.ok){setAddSt('success');setResult({slug,cardUrl:`https://${DOMAIN}/${slug}`})}
    else{setAddSt('error');setAddErr(d.error||'Something went wrong.')}
  }

  async function copy() {
    if(!result) return
    await navigator.clipboard.writeText(result.cardUrl)
    setCopied(true); setTimeout(()=>setCopied(false),2000)
  }

  function reset() {
    setAddSt(null);setResult(null);setAddErr('');setCopied(false)
    setPicked(false);setQuery('');setName('');setGUrl('');setPid('');setSlug('')
    setPStatus(null);setHistory([]);setLogSt(null);setRep('');setOutcome('')
  }

  const canAdd = picked && slug.trim() && pStatus!=='checking' && addSt!=='loading'

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <div style={{
      minHeight:'100vh',
      background:NAVY,
      backgroundImage:'radial-gradient(ellipse 80% 35% at 50% 0%,rgba(196,165,53,.17) 0%,transparent 65%)',
      fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
      WebkitFontSmoothing:'antialiased',
      display:'flex', flexDirection:'column', alignItems:'center',
      padding:'32px 16px 64px',
    }}>
      <style>{`
        .i:focus{border-color:${GOLD}!important;background:#fff!important;box-shadow:0 0 0 3px rgba(196,165,53,.14)!important}
        .dr:active{background:#F4F4F7!important}
        button:active{opacity:.8}
      `}</style>

      {/* ── brand ─────────────────────────────────────────────────── */}
      <div style={{
        display:'flex',alignItems:'center',justifyContent:'space-between',
        width:'100%',maxWidth:400,marginBottom:20,
      }}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{
            width:36,height:36,borderRadius:10,flexShrink:0,
            background:'linear-gradient(145deg,#D4AA40,#8A6800)',
            display:'flex',alignItems:'center',justifyContent:'center',
            fontWeight:800,fontSize:16,color:'#fff',
            boxShadow:'0 4px 12px rgba(196,165,53,.45)',
          }}>A</div>
          <div>
            <div style={{color:'#fff',fontWeight:700,fontSize:14,letterSpacing:-.2}}>Apex Tap Cards</div>
            <div style={{color:'rgba(255,255,255,.35)',fontSize:11,letterSpacing:.5,textTransform:'uppercase'}}>Admin</div>
          </div>
        </div>
        {authed && (
          <div style={{
            display:'flex',alignItems:'center',gap:6,
            background:'rgba(196,165,53,.1)',border:'1px solid rgba(196,165,53,.2)',
            borderRadius:20,padding:'4px 10px',
            color:GOLD,fontSize:11,fontWeight:700,letterSpacing:.7,
          }}>
            <div style={{width:5,height:5,borderRadius:'50%',background:GOLD,boxShadow:`0 0 6px ${GOLD}`}}/>
            LIVE
          </div>
        )}
      </div>

      {/* ── card ──────────────────────────────────────────────────── */}
      <div style={{
        width:'100%',maxWidth:400,
        background:'#fff',borderRadius:20,
        padding:'28px 22px',
        boxShadow:'0 20px 60px rgba(0,0,0,.55)',
      }}>

        {/* LOGIN */}
        {!authed && (
          <form onSubmit={login}>
            <div style={{fontSize:22,fontWeight:800,color:NAVY,letterSpacing:-.5,marginBottom:4}}>Sign in</div>
            <div style={{fontSize:14,color:'#999',marginBottom:22}}>Access the Apex admin portal</div>
            <Label>Password</Label>
            <Input type="password" placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)} autoFocus style={{marginBottom:12}}/>
            {pwErr && (
              <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:10,
                padding:'10px 14px',color:'#DC2626',fontSize:13,fontWeight:500,marginBottom:12}}>
                {pwErr}
              </div>
            )}
            <Btn gold type="submit">Sign In</Btn>
          </form>
        )}

        {/* SUCCESS */}
        {authed && addSt==='success' && result && (
          <div style={{textAlign:'center'}}>
            <div style={{
              width:68,height:68,borderRadius:'50%',
              background:'linear-gradient(135deg,#D4AA40,#8A6800)',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:30,color:'#fff',margin:'0 auto 18px',
              boxShadow:'0 8px 24px rgba(196,165,53,.45)',
            }}>✓</div>
            <div style={{fontSize:20,fontWeight:800,color:NAVY,letterSpacing:-.4,marginBottom:6}}>{name} is live!</div>
            <div style={{fontSize:14,color:'#999',marginBottom:20}}>Program each NFC card with this URL</div>
            <div style={{
              background:NAVY,borderRadius:12,padding:'14px',
              fontFamily:'monospace',fontSize:13,color:GOLD,fontWeight:700,
              wordBreak:'break-all',lineHeight:1.5,marginBottom:16,
              border:'1px solid rgba(196,165,53,.15)',
            }}>{result.cardUrl}</div>
            <Btn gold onClick={copy} style={{marginBottom:10,
              background:copied?'linear-gradient(135deg,#22C55E,#16A34A)':undefined,
              boxShadow:copied?'0 4px 16px rgba(34,197,94,.4)':undefined}}>
              {copied?'✓ Copied!':'Copy URL'}
            </Btn>
            <Btn onClick={reset}>Add Another</Btn>
          </div>
        )}

        {/* MAIN FORM */}
        {authed && addSt!=='success' && (
          <form onSubmit={addClient}>

            {/* search */}
            <Label>Search Business</Label>
            <div style={{position:'relative',marginBottom:16}}>
              <span style={{
                position:'absolute',left:13,top:'50%',transform:'translateY(-50%)',
                fontSize:17,color:picked?GOLD:'#C0C0CC',pointerEvents:'none',
                transition:'color .15s',lineHeight:1,
              }}>⌕</span>
              <Input
                className="i"
                type="text"
                placeholder="Business name..."
                value={query}
                onChange={onQ}
                onFocus={()=>{if(sugs.length>0)setDrop(true)}}
                onBlur={()=>{if(!inDrop.current)setDrop(false)}}
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
                style={{paddingLeft:40}}
              />
              {drop && sugs.length>0 && (
                <div
                  onMouseDown={()=>{inDrop.current=true}}
                  onMouseUp={()=>{inDrop.current=false}}
                  onTouchStart={()=>{inDrop.current=true}}
                  onTouchEnd={()=>{inDrop.current=false}}
                  style={{
                    position:'absolute',top:'calc(100% + 6px)',left:0,right:0,
                    background:'#fff',borderRadius:14,zIndex:999,
                    boxShadow:'0 8px 30px rgba(0,0,0,.13),0 0 0 1px rgba(0,0,0,.05)',
                    overflow:'hidden',
                  }}
                >
                  {sugs.map((s,i)=>{
                    const p=s.placePrediction
                    const main=p?.structuredFormat?.mainText?.text||p?.text?.text||''
                    const sec=p?.structuredFormat?.secondaryText?.text||''
                    return (
                      <div key={i} className="dr"
                        onMouseDown={e=>{e.preventDefault();pick(s)}}
                        onTouchEnd={e=>{e.preventDefault();pick(s)}}
                        style={{
                          padding:'12px 14px',cursor:'pointer',
                          borderBottom:i<sugs.length-1?'1px solid #F0F0F4':'none',
                          minHeight:52,display:'flex',flexDirection:'column',justifyContent:'center',
                        }}>
                        <div style={{fontSize:15,fontWeight:600,color:'#111',lineHeight:1.3}}>{main}</div>
                        {sec&&<div style={{fontSize:12,color:'#AAA',marginTop:2,lineHeight:1.3}}>{sec}</div>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* status */}
            {pStatus==='checking' && (
              <StatusPill color="#999" bg="#F7F7FA" border="#EEEEF4" dot="#D0D0DC">
                Checking...
              </StatusPill>
            )}
            {pStatus==='new' && (
              <StatusPill color="#15803D" bg="#F0FDF4" border="#BBF7D0" dot="#22C55E">
                New lead — never visited
              </StatusPill>
            )}
            {pStatus==='pitched' && (
              <div style={{background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:12,padding:'12px 14px',marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',gap:8,fontSize:14,color:'#92400E',fontWeight:700,marginBottom:history.length?10:0}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:'#F59E0B',flexShrink:0}}/>
                  Already visited
                </div>
                {history.map((h,i)=>(
                  <div key={i} style={{borderTop:'1px solid rgba(253,230,138,.7)',paddingTop:7,marginTop:7,fontSize:13,color:'#78350F',lineHeight:1.6}}>
                    <b>{h.visited_by}</b> · {OUTCOMES[h.outcome]||h.outcome} · <span style={{color:'#A16207'}}>{fmtDate(h.visited_at)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* log visit */}
            {picked && (pStatus==='new'||pStatus==='pitched') && logSt!=='logged' && (
              <div style={{background:'#F7F7FA',borderRadius:14,padding:'16px 14px',marginBottom:16,border:'1px solid #EEEEF4'}}>
                <Label>Log This Visit</Label>
                <Input type="text" placeholder="Your name" value={rep} onChange={e=>setRep(e.target.value)}
                  style={{marginBottom:8,background:'#fff'}}/>
                <div style={{position:'relative',marginBottom:10}}>
                  <select className="i" value={outcome} onChange={e=>setOutcome(e.target.value)}
                    style={{...inp,background:'#fff',paddingRight:34,cursor:'pointer',color:outcome?'#111':'#AAA'}}>
                    <option value="">Select outcome...</option>
                    <option value="pitched">Pitched — Awaiting Decision</option>
                    <option value="not_interested">Not Interested</option>
                    <option value="follow_up">Follow-Up Scheduled</option>
                    <option value="sold">Sold ✓</option>
                  </select>
                  <span style={{position:'absolute',right:13,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:'#AAA',fontSize:11}}>▼</span>
                </div>
                <Btn onClick={logVisit}
                  disabled={!rep.trim()||!outcome||logSt==='loading'}
                  style={{background:'#fff',border:'1.5px solid #DDDDE8',color:'#444',boxShadow:'none'}}>
                  {logSt==='loading'?'Logging...':'Log Visit'}
                </Btn>
                {logSt==='error'&&<div style={{color:'#DC2626',fontSize:13,marginTop:8}}>Failed — try again.</div>}
              </div>
            )}
            {logSt==='logged' && (
              <div style={{display:'flex',alignItems:'center',gap:8,background:'#F0FDF4',
                border:'1px solid #BBF7D0',borderRadius:12,padding:'11px 14px',marginBottom:16,
                fontSize:14,color:'#15803D',fontWeight:600}}>
                <span style={{width:18,height:18,borderRadius:'50%',background:'#22C55E',
                  color:'#fff',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✓</span>
                Visit logged
              </div>
            )}

            {/* add client */}
            {picked && pStatus!=='checking' && (
              <div style={{background:'#F7F7FA',borderRadius:14,padding:'16px 14px',border:'1px solid #EEEEF4'}}>
                <Label>Add as Client</Label>
                <div style={{fontSize:14,color:'#15803D',fontWeight:600,marginBottom:14,display:'flex',alignItems:'center',gap:7}}>
                  <span style={{width:16,height:16,borderRadius:'50%',background:'#22C55E',color:'#fff',
                    fontSize:9,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✓</span>
                  {name}
                </div>
                <Label>URL Slug</Label>
                <Input type="text" value={slug}
                  onChange={e=>setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))}
                  style={{fontFamily:'monospace',letterSpacing:.3,background:'#fff',marginBottom:10}}/>
                <div style={{background:NAVY,borderRadius:10,padding:'10px 12px',marginBottom:14,
                  fontFamily:'monospace',fontSize:13,wordBreak:'break-all',lineHeight:1.5,
                  border:'1px solid rgba(196,165,53,.12)'}}>
                  <span style={{color:'rgba(255,255,255,.3)'}}>{DOMAIN}/</span>
                  <span style={{color:GOLD,fontWeight:700}}>{slug||'...'}</span>
                </div>
                {addSt==='error' && (
                  <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:10,
                    padding:'10px 13px',color:'#DC2626',fontSize:13,fontWeight:500,marginBottom:12}}>
                    {addErr}
                  </div>
                )}
                <Btn gold type="submit" disabled={!canAdd}>
                  {addSt==='loading'?'Adding...':'Add Client'}
                </Btn>
              </div>
            )}

          </form>
        )}

      </div>
    </div>
  )
}
