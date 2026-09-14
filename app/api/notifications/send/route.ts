import { NextResponse } from 'next/server'
import { getAdminFirestore, getAdminMessaging } from '@/lib/firebase/admin'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { title?: string; body?: string; sound?: string }
    const title = payload.title?.trim()
    const body = payload.body?.trim()

    if (!title || !body || title.length > 120 || body.length > 500) {
      return NextResponse.json({ error: 'Título o mensaje inválido' }, { status: 400 })
    }

    const adminFirestore = getAdminFirestore()
    const adminMessaging = getAdminMessaging()
    const snapshot = await adminFirestore.collection('push_tokens').get()
    const tokens = snapshot.docs.map((doc) => ({ id: doc.id, token: doc.get('token') as string })).filter((item) => item.token)
    if (!tokens.length) return NextResponse.json({ sent: 0 })

    const result = await adminMessaging.sendEachForMulticast({
      tokens: tokens.map((item) => item.token),
      notification: { title, body },
      data: { sound: payload.sound ?? 'default' },
      android: { notification: { channelId: 'alertas', sound: payload.sound ?? 'default', priority: 'high' } },
      webpush: { notification: { title, body, requireInteraction: true }, fcmOptions: { link: '/' } },
    })

    const invalidTokens = result.responses.flatMap((response, index) => response.success ? [] : [tokens[index]]).filter((item) => item)
    await Promise.all(invalidTokens.map(({ id }) => adminFirestore.collection('push_tokens').doc(id).delete()))

    return NextResponse.json({ sent: result.successCount, removed: invalidTokens.length })
  } catch (error) {
    console.error('[v0] Firebase notification error', error)
    return NextResponse.json({ error: 'No se pudo enviar la notificación' }, { status: 500 })
  }
}
