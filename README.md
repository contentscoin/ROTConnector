# ROTConnector — 알비연 링크

> 선후배의 신뢰를 비즈니스 연결로.
> ROTC 비즈니스연합회 회원의 도움요청 · 사업소개 · 행사 · 후원 · 협업을 한곳에.

신뢰 기반 비즈니스 **연결 OS**. 자세한 기획은 [`PLAN.md`](./PLAN.md) 참고.

## 라이브

- **웹앱**: https://rotconnector.vercel.app
- **로그인**: 운영진이 등록한 회원 휴대폰 번호로 클레임 로그인.
  데모/운영 계정 번호는 보안상 공개하지 않습니다(시드 데이터는 `convex/seed.ts` 참고, 운영 배포 시 교체).

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

# 프론트 (Vercel 프로덕션: 프로젝트 rotconnector)
vercel --prod --yes
# 위가 "Project not found" 면 스코프를 지정한다(팀 스코프의 프로젝트일 때)
# vercel --prod --yes --scope jakes-projects-0ab50f91
```

CI 배포(`.github/workflows/deploy.yml`)는 프로젝트 **이름**으로 `vercel link` 를 먼저 실행하고,
`--scope` 없이 먼저 시도한 뒤 실패하면 스코프를 붙여 재시도한다. 매 실행마다
`vercel whoami` / `teams ls` / `project ls` 결과를 로그에 출력해 값이 틀렸으면 바로 알 수 있다.
필요 시크릿은 `CONVEX_DEPLOY_KEY`, `VERCEL_TOKEN` 두 개뿐 — 자세한 설정은 `DEPLOY.md` §0 참고.

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

## 보안 / 알려진 한계

1차 하드닝 반영:
- **PII 격리**: 공개 회원 쿼리(`members.list/get`)는 phone 등 비공개 필드를 projection으로 제거. 전체 PII는 본인(`auth.me`)·운영진(`admin.dashboard`)에서만 노출.
- **세션**: 30일 만료(`convex/auth.ts`), 무효 토큰은 클라이언트에서 자동 정리(유령 세션 트랩 제거).
- **로그인**: phone당 슬라이딩 윈도우 레이트리밋(브루트포스 완화).
- **저장형 XSS 차단**: 회원 링크 URL은 `http(s)` 스킴만 허용(서버·렌더 양측 검증).
- **상태머신**: 요청 상태를 매칭 현황에서 재계산, `complete`/`propose`가 종료(closed) 요청을 되살리지 않음, 매칭 삭제 시 기여 점수 롤백.

Phase 2 잔여(여전히 `convex/auth.ts` 한 곳에 격리):
- **인증 정공법**: phone-claim은 단일요소라 SMS OTP 또는 카카오 OAuth로 교체 예정(`requestOtp`/`verifyOtp` 분리).
- 운영진 대시보드의 회원 연락처(PII)는 운영 목적상 노출 (admin 권한 게이트).

## 코드 리뷰

멀티에이전트 리뷰(보안·버그·로직·a11y·배포) 1차 반영 완료:
점수 음수/중복 적립 방지, 요청 상태전이 권한 제한, null 방어, WCAG 대비/터치타깃 개선.
