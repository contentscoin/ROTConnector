// 웹 푸시(FCM) 등록 유틸. VITE_FIREBASE_* env가 모두 설정된 경우에만 동작하고,
// firebase SDK는 동적 import라 미설정 시 메인 번들에 포함되지 않는다.

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as
    | string
    | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined

// Firebase 설정이 갖춰졌는지 (빌드 타임 상수).
export const pushConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId &&
    vapidKey,
)

// 브라우저 웹 푸시 지원 여부 (SW + Notification + Push).
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'Notification' in window &&
    'PushManager' in window
  )
}

// 이미 알림 권한이 허용돼 있는지.
export function pushPermissionGranted(): boolean {
  return (
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  )
}

// 사용자 제스처에서 호출: 권한 요청 → FCM 토큰 발급 → 토큰 반환.
// 반환: FCM 디바이스 토큰(성공) / null(미설정·미지원·권한거부·실패).
export async function enableWebPush(): Promise<string | null> {
  if (!pushConfigured || !pushSupported()) return null
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const { initializeApp, getApps } = await import('firebase/app')
  const { getMessaging, getToken, isSupported } = await import(
    'firebase/messaging'
  )
  if (!(await isSupported())) return null

  const app = getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig as Record<string, string>)
  const messaging = getMessaging(app)

  // SW에 공개 설정을 쿼리로 전달 (SW는 import.meta.env를 읽지 못함).
  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey as string,
    projectId: firebaseConfig.projectId as string,
    messagingSenderId: firebaseConfig.messagingSenderId as string,
    appId: firebaseConfig.appId as string,
  })
  const swReg = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${params.toString()}`,
  )

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swReg,
  })
  return token || null
}
