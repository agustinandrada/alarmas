import { getApp, getApps, initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

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
