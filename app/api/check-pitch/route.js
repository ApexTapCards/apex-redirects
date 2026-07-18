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

  // Check if already a client — by the full location-specific slug
  if (passedSlug) {
    const { data: clients } = await supabase
      .from('redirects')
      .select('client_name, slug')
      .eq('slug', passedSlug)

    if (clients && clients.length > 0) {
      return NextResponse.json({ status: 'client', client: clients[0] })
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
