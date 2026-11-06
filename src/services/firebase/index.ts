import type { Services } from '../types'

/**
 * Firebase implementation of the service layer: written in Phase 9 (not started yet).
 *
 * Planned mapping:
 *  - auth           → firebase/auth (onAuthStateChanged, signInWithEmailAndPassword after
 *                     functions.resolveLoginIdentifier, getIdTokenResult().claims)
 *  - directory/notifications/deliveries/sms/audit/settings/devices
 *                   → firebase/firestore onSnapshot queries on the same collection names
 *                     (Timestamp → Date converted in a FirestoreDataConverter)
 *  - functions      → httpsCallable(functions, '<name>') for every method of `Functions`
 *  - devices        → firebase/messaging getToken(vapidKey) stored in users/{uid}/devices
 *  - uploads        → firebase/storage uploadBytes + getDownloadURL
 */
export async function createFirebaseServices(): Promise<Services> {
  await import('@/lib/firebase').then((m) => m.getFirebaseApp())
  throw new Error('The Firebase data source is not implemented yet (Phase 9). Set VITE_DATA_SOURCE=mock.')
}
