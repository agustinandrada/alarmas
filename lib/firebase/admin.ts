import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

function getPrivateKey() {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
}

function getAdminApp() {
  if (getApps().length) return getApps()[0]
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = getPrivateKey()
  if (!projectId || !clientEmail || !privateKey) throw new Error('Faltan credenciales privadas de Firebase')
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp())
}

export function getAdminMessaging() {
  return getMessaging(getAdminApp())
}
