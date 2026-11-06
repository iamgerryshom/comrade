import type { FirebaseApp } from 'firebase/app'
import { env } from './env'

/**
 * Firebase initialisation. NOT active in mock mode: nothing here runs unless
 * VITE_DATA_SOURCE=firebase. Imported dynamically so the SDK isn't in the mock bundle.
 * Phase 9 adds Firestore offline persistence, Functions region, and FCM web push.
 */
let app: FirebaseApp | null = null

export async function getFirebaseApp(): Promise<FirebaseApp> {
  if (env.dataSource !== 'firebase') throw new Error('Firebase is disabled (VITE_DATA_SOURCE is not "firebase")')
  if (app) return app
  const { initializeApp } = await import('firebase/app')
  app = initializeApp(env.firebase)
  return app
}

export async function getFirebase() {
  const a = await getFirebaseApp()
  const [{ getAuth }, { initializeFirestore, persistentLocalCache }, { getFunctions }, { getStorage }] = await Promise.all([
    import('firebase/auth'),
    import('firebase/firestore'),
    import('firebase/functions'),
    import('firebase/storage'),
  ])
  return {
    app: a,
    auth: getAuth(a),
    // Offline persistence so the inbox works without a connection
    db: initializeFirestore(a, { localCache: persistentLocalCache() }),
    functions: getFunctions(a, 'africa-south1'),
    storage: getStorage(a),
  }
}
