import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  const { slug, client_name, google_url, password } = await request.json()

  // Verify admin password
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate inputs
  if (!slug || !client_name || !google_url) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  const slugClean = slug.toLowerCase().replace(/[^a-z0-9-]/g, '')
  if (!slugClean) {
    return NextResponse.json({ error: 'Invalid slug.' }, { status: 400 })
  }

  const { error } = await supabase.from('redirects').insert([
    { slug: slugClean, client_name, google_url },
  ])

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `The URL slug "${slugClean}" is already taken. Try editing the slug.` },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, slug: slugClean })
}
