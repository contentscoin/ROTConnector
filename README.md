# ROTConnector — 알비연 링크

> 선후배의 신뢰를 비즈니스 연결로.
> ROTC 비즈니스연합회 회원의 도움요청 · 사업소개 · 행사 · 후원 · 협업을 한곳에.

신뢰 기반 비즈니스 **연결 OS**. 자세한 기획은 [`PLAN.md`](./PLAN.md) 참고.

## 라이브

- **웹앱**: https://rotconnector.vercel.app
- **데모 계정**
  - 운영진: `010-1111-0000` (김도현)
  - 회원: `010-2222-0001` (이상훈) 등

## 스택

Vite + React 19 + TypeScript · Tailwind v4 · React Router v7 · **Convex**(백엔드/DB) · **Vercel**(배포) · **Capacitor**(모바일 래핑)

## MVP 기능

1. 회원 프로필 디렉토리 (검색·업종/지역 필터)
2. 도움요청 게시판 (상태 추적: 접수 → 매칭중 → 연결완료)
3. 운영진 중개 대시보드 (회원 연결 제안·완료, 회원 등록/승인, 기여 적립)

## 개발

```bash
pnpm install
npx convex dev      # 백엔드(dev: friendly-lyrebird-901) 실행 + 타입 생성
pnpm dev            # 프론트(localhost:5173)
# 시드: npx convex run seed:run
```

`.env.local`(dev) / `.env.production`(prod)에 `VITE_CONVEX_URL` 설정.

## 배포

```bash
# 백엔드 (Convex 프로덕션: robust-ostrich-0)
npx convex deploy -y

# 프론트 (Vercel 프로덕션)
vercel --prod --yes --scope jakes-projects-0ab50f91
```

## 모바일 (Capacitor) 다음 단계

```bash
pnpm build
npx cap add ios     # Xcode 필요
npx cap add android # Android Studio 필요
npx cap sync
npx cap open ios    # / android
```

웹앱(dist)을 그대로 네이티브 래핑. `capacitor.config.ts` 이미 존재 (appId: `kr.albiyeon.link`).
릴리스 빌드는 `.env.production`의 prod Convex URL 사용.

## 알려진 한계 (Phase 2 하드닝)

- **인증**: 파일럿 등급 phone-claim 세션(세션 만료 없음). → Convex Auth(Password/OTP) 또는 카카오 OAuth로 교체 예정. (`convex/auth.ts` 한 곳에 격리)
- 요청 상태 `closed` 수동 전환, 다중 매칭 시 상태 머신 단순화.
- 운영진 대시보드의 회원 연락처(PII)는 운영 목적상 노출 (admin 권한 게이트).

## 코드 리뷰

멀티에이전트 리뷰(보안·버그·로직·a11y·배포) 1차 반영 완료:
점수 음수/중복 적립 방지, 요청 상태전이 권한 제한, null 방어, WCAG 대비/터치타깃 개선.
