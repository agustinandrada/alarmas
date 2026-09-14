import { getApp, getApps, initializeApp } from 'firebase/app'
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'
import { getMessaging, getToken, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyCZzVE41GX2lK0JZsAu0FJy2ylCdbIoQgs',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'alertas-18f5c.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'alertas-18f5c',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'alertas-18f5c.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '965595683968',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '1:965595683968:web:alertaweb',
}

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const firestore = getFirestore(firebaseApp)

export async function requestAndSaveWebToken() {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    const supported = await isSupported()
    if (!supported) return

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    let registration: ServiceWorkerRegistration | undefined
    if ('serviceWorker' in navigator) {
      registration = await navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    }

    const messaging = getMessaging(firebaseApp)
    const token = await getToken(messaging, {
      serviceWorkerRegistration: registration,
    }).catch((e) => {
      console.warn('FCM getToken Web error:', e)
      return null
    })

    if (token) {
      await setDoc(doc(firestore, 'push_tokens', token), {
        token,
        platform: 'web',
        updated_at: serverTimestamp()
      }, { merge: true })
    }
  } catch (err) {
    console.error('Error registrando token de notificaciones web:', err)
  }
}
