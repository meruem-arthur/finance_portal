// Firebase setup for the GESA Finance Portal.
// Fill in your Firebase project credentials in a .env file (see .env.example).
// If you already have a Firebase project for the main GESA app, you can reuse
// it here — just point FIREBASE_PROJECT_ID etc. at the same project, and this
// portal will read/write a separate "financePeriods" collection so it never
// touches your existing app data.

import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const hasConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

// Only touch the Firebase SDK when real credentials are present. In demo
// mode (no .env set up yet) we skip this entirely, since even constructing
// getAuth()/getFirestore() with empty config can throw.
let app = null
let db = null
let auth = null

if (hasConfig) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
  db = getFirestore(app)
  auth = getAuth(app)
}

export { db, auth }
export default app
