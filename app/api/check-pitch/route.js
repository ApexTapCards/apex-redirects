import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const placeId = searchParams.get('placeId')
  const businessName = searchParams.get('businessName')
  const passedSlug = searchParams.get('slug')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Check if already a client — exact slug match OR name match
  if (passedSlug || businessName) {
    const conditions = []
    if (passedSlug) conditions.push(`slug.eq.${passedSlug}`)
    if (businessName) conditions.push(`client_name.ilike.${businessName}`)

    const { data: clients } = await supabase
      .from('redirects')
      .select('client_name, slug')
      .or(conditions.join(','))

    if (clients && clients.length > 0) {
      // Only block if the exact slug already exists (same location)
      // A name-only match means it's a different location of the same business
      const exactMatch = clients.some(c => c.slug === passedSlug)
      if (exactMatch || !passedSlug) {
        return NextResponse.json({ status: 'client', client: clients[0] })
      }
      // Different location — warn but don't block
      return NextResponse.json({ status: 'existing_location', clients })
    }
  }

  // Check pitch history
  if (placeId) {
    const { data: pitches } = await supabase
      .from('pitches')
      .select('visited_by, outcome, visited_at')
      .eq('place_id', placeId)
      .order('visited_at', { ascending: false })

    if (pitches && pitches.length > 0) {
      return NextResponse.json({ status: 'pitched', pitches })
    }
  }

  return NextResponse.json({ status: 'new' })
}
