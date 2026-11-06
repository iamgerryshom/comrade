/** Typed access to VITE_ env variables. Never put secrets here: everything VITE_ ships to the browser. */
export const env = {
  dataSource: (import.meta.env.VITE_DATA_SOURCE ?? 'mock') as 'mock' | 'firebase',
  demoMode: (import.meta.env.VITE_DEMO_MODE ?? 'true') !== 'false',
  ackTimeoutSeconds: Number(import.meta.env.VITE_ACK_TIMEOUT_SECONDS ?? 60) || 60,
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  },
  vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY ?? '',
}
