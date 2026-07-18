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

  // 1. Exact slug match — same location, already a client, block
  if (passedSlug) {
    const { data: slugMatch } = await supabase
      .from('redirects')
      .select('client_name, slug')
      .eq('slug', passedSlug)
      .limit(1)

    if (slugMatch && slugMatch.length > 0) {
      return NextResponse.json({ status: 'client', client: slugMatch[0] })
    }
  }

  // 2. Name match only — possibly a different location, warn but don't block
  if (businessName) {
    const { data: nameMatch } = await supabase
      .from('redirects')
      .select('client_name, slug')
      .ilike('client_name', businessName)
      .limit(5)

    if (nameMatch && nameMatch.length > 0) {
      return NextResponse.json({ status: 'existing_location', clients: nameMatch })
    }
  }

  // 3. Check pitch history by placeId
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
