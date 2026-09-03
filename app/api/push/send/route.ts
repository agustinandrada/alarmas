import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const { title, body, sound = 'default' } = await request.json()
  if (!title || !body) return NextResponse.json({ error: 'Mensaje inválido' }, { status: 400 })
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) return NextResponse.json({ error: 'Push no configurado' }, { status: 503 })
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY)
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: rows } = await supabase.from('push_subscriptions').select('id,subscription')
  const results = await Promise.allSettled((rows ?? []).map((row) => webpush.sendNotification(row.subscription, JSON.stringify({ title, body, sound, tag: 'alerta-grupo' }))))
  const expired = (rows ?? []).filter((_, index) => results[index].status === 'rejected' && (results[index] as PromiseRejectedResult).reason?.statusCode === 410).map((row) => row.id)
  if (expired.length) await supabase.from('push_subscriptions').delete().in('id', expired)
  return NextResponse.json({ sent: results.filter((result) => result.status === 'fulfilled').length })
}

export const runtime = 'nodejs'
