# 배포 · 런치 체크리스트 (알비연 링크)

스택: Convex(백엔드/DB) + Vite/React SPA(Vercel) + Capacitor(iOS/Android).
패키지 매니저는 **pnpm**(`pnpm-lock.yaml` 기준, Vercel `buildCommand: pnpm build`).

---

## 1. 사전 점검 (코드)

- [ ] `pnpm build` 로컬 성공 (`tsc -b && vite build`)
- [ ] `.env.production`의 `VITE_CONVEX_URL`이 **프로덕션** Convex 배포를 가리키는지 확인
      (dev 배포 URL이 아닌지). Convex 클라이언트 URL은 공개값이라 커밋해도 안전.
- [ ] `.env.local`(dev `CONVEX_DEPLOYMENT` 토큰)은 `*.local` 규칙으로 gitignore됨 — 커밋 금지.

## 2. Convex 프로덕션 배포

```bash
npx convex deploy            # 함수 + 스키마를 prod에 배포
```

- 신규 테이블(`notifications`, `auditLogs`, `eventRsvps`)은 **추가 전용**이라 배포 시 자동 생성됨.
  별도 마이그레이션·백필 불필요(초기 빈 상태).
- 레거시 cohort 표기 정규화가 필요한 기존 데이터가 있으면(1회):
  ```bash
  npx convex run migrations:normalizeCohorts
  ```

## 3. 최초 운영진 부트스트랩 (중요)

`members.setAdmin`은 기존 운영진을 요구하므로, 시드 없는 prod에선 첫 운영진을 만들 수 없다.
순서:

1. 운영자가 될 사람이 앱에서 **본인 phone으로 계정 클레임**(프로필 작성).
2. 1회 실행으로 승격(active 운영진):
   ```bash
   npx convex run migrations:promoteAdmin '{"phone":"01012345678"}'
   ```
   - `internalMutation`이라 클라이언트에서 호출 불가(안전).
   - 이후 추가 운영진은 운영진 콘솔(/admin → 회원)에서 토글로 지정.

> **prod에서 `seed:run` 실행 금지** — 데모 회원 13명·샘플 데이터를 만든다. 시드는 dev 전용.
> 데모 admin(`김도현 / 01011110000`)은 시드 데이터일 뿐, prod 운영진이 아니다.

## 4. 프론트엔드 배포 (Vercel)

- Git 푸시 → Vercel 자동 빌드, 또는 `vercel --prod`.
- SPA rewrite는 `vercel.json`에서 **확장자 없는 경로만** index.html로 보냄
  (`/((?!.*\.).*)`) — manifest/아이콘/정적 자산은 그대로 제공.

## 5. 배포 후 스모크 테스트

- [ ] `/manifest.webmanifest`, `/apple-touch-icon.png`, `/icons/*` 가 200(HTML 아님)으로 로드 — PWA 설치 가능
- [ ] 딥링크 새로고침 동작: `/members/<id>`, `/events/<id>`, `/requests/<id>` 직접 진입 시 404 아님
- [ ] phone 클레임 → 로그인 → 프로필 작성 → 운영진 승인(pending→active) 흐름
- [ ] 도움요청 등록 → 운영진 매칭(propose)·완료(complete) → 작성자/헬퍼 **알림 수신**(헤더 벨)
- [ ] 교류 신청 → 수락 시에만 상호 연락처 노출, 알림 수신
- [ ] 행사 등록 → 전체 회원 알림 + 참석/관심 RSVP + 상세 참석자 명단
- [ ] 정지(suspended) 처리 시 해당 계정 즉시 로그아웃·디렉토리/피드에서 제외

## 6. 모바일 릴리스 (선택)

```bash
pnpm build && npx cap sync
npx cap open ios     # / android
```

## 7. 푸시 알림 (FCM) 설정

코드 연동은 완료돼 있고(인앱 알림 생성 시 자동 푸시 스케줄), **자격증명만 채우면 작동**한다.
미설정 시 푸시는 no-op이라 앱은 정상 동작한다.

1. **Firebase 프로젝트 생성** → 웹 앱 추가 → Cloud Messaging 활성화.
2. **클라이언트 공개 설정**을 `.env.production`에 채우기(모두 공개값, 커밋 가능):
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`,
   `VITE_FIREBASE_VAPID_KEY`(클라우드 메시징 → 웹 푸시 인증서).
3. **서버 비밀(서비스 계정)** 을 Convex 환경변수로(파일/깃 금지):
   - Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성(JSON).
   - `npx convex env set FCM_SERVICE_ACCOUNT "$(cat service-account.json)"`
4. 재배포(`npx convex deploy` + Vercel). 회원이 `/notifications`의 **"브라우저 푸시 알림 켜기"** 로 권한 허용 → 디바이스 토큰이 `pushTokens`에 등록됨.

- 인앱 알림 8종 전부 푸시로도 전달된다(교류·매칭·도움요청·행사·가입승인).
- 무효/만료 토큰은 발송 시 자동 정리(404/400).
- 규모 주의: 행사 등록 팬아웃은 회원 수만큼 푸시 액션을 만들고 각 액션이 OAuth 토큰을
  발급한다 — 회원 수백+ 환경에선 단일 액션 다중 토큰 발송으로 배치 권장.

### 네이티브(iOS/Android) 푸시 — 후속

백엔드(`pushTokens`/`push.register`/발송)는 플랫폼 무관(FCM 토큰만 있으면 됨)이라 그대로 재사용.
네이티브는 `@capacitor/push-notifications` 설치 + APNs(iOS)/`google-services.json`(Android)
설정 후, 플러그인의 registration 토큰을 `api.push.register({ token, fcmToken, platform: 'ios'|'android' })`
로 보내면 된다. (Apple Developer/네이티브 빌드 환경 필요 — 별도 작업)

## 미구현 (외부 자격증명 필요)

- 카카오 알림톡 — 자격증명 확보 후 연동.
- OTP 로그인 — 현재 phone 클레임 파일럿 인증. (의도적 보류)
