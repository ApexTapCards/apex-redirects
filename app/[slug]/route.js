import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

export async function GET(request, { params }) {
  const { slug } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const { data, error } = await supabase
    .from('redirects')
    .select('google_url')
    .eq('slug', slug)
    .single()

  // If slug not found, send to main website
  if (error || !data) {
    redirect('https://apextapcards.com')
  }

  redirect(data.google_url)
}
