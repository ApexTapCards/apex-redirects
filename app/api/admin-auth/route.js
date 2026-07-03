import { NextResponse } from 'next/server'

export async function POST(request) {
  const { password } = await request.json()
  if (password === process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
