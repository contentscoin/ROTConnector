/* FCM 백그라운드 메시지 서비스 워커.
 * 공개 Firebase 설정은 앱이 SW 등록 시 쿼리스트링으로 전달한다
 * (SW는 import.meta.env를 읽지 못하므로). 모두 공개값이라 노출돼도 안전. */
importScripts(
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
)
importScripts(
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js',
)

const params = new URL(self.location).searchParams
firebase.initializeApp({
  apiKey: params.get('apiKey'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {}
  const link = (payload.data && payload.data.link) || '/'
  self.registration.showNotification(n.title || '알비연 링크', {
    body: n.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { link },
  })
})

// 알림 클릭 → 이미 열린 탭이 있으면 포커스, 없으면 새 창.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || '/'
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((wins) => {
        for (const w of wins) {
          if ('focus' in w) {
            w.navigate(link)
            return w.focus()
          }
        }
        return clients.openWindow(link)
      }),
  )
})
