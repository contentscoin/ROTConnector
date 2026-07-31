# 배포 · 런치 체크리스트 (알비연 링크)

스택: Convex(백엔드/DB) + Vite/React SPA(Vercel) + Capacitor(iOS/Android).
패키지 매니저는 **pnpm**(`pnpm-lock.yaml` 기준, Vercel `buildCommand: pnpm build`).

---

## 0. CI/CD 파이프라인

배포는 **두 갈래**다. 프론트엔드는 **Vercel git 연동**이, 백엔드(Convex)는
**GitHub Actions**가 담당한다. 둘 다 `main` push로 트리거된다.

| 대상 | 배포 주체 | 트리거 | 필요 시크릿 |
| --- | --- | --- | --- |
| 프론트(Vite SPA) | **Vercel** (대시보드 git 연동) | `main` push | 없음 (GitHub App 연결) |
| 백엔드(Convex) | GitHub Actions `deploy.yml` | `main` push · 수동 실행 | `CONVEX_DEPLOY_KEY` |

### CI (`.github/workflows/ci.yml`)
- **트리거**: `main` 브랜치 push 및 PR
- **단계**: pnpm install -> lint -> type-check + build
- PR 머지 전 빌드 성공 필수

### 프론트엔드 배포 (Vercel git 연동)
- **트리거**: `main` push → Vercel이 저장소를 클론해 스스로 빌드·배포한다.
  GitHub Actions는 프론트를 **전혀 배포하지 않는다**(Vercel CLI 단계는 제거됨).
- 빌드 설정은 저장소의 `vercel.json`을 그대로 따른다
  (`framework: vite`, `buildCommand: pnpm build`, `outputDirectory: dist`, SPA rewrite, 보안 헤더/CSP).
- 대시보드에서 **1회만** 해야 하는 연결 작업은 §0-1 참고.
- 배포 로그·롤백은 Vercel 대시보드 → 프로젝트 `rotconnector` → Deployments 에서 본다.

### 백엔드 배포 (`.github/workflows/deploy.yml`)
- **워크플로우 이름**: `Deploy Production (backend / Convex)` (파일명은 그대로 `deploy.yml`).
- **트리거**
  - `main` 브랜치 push (머지 시 자동 배포)
  - **수동 실행**(`workflow_dispatch`): GitHub **Actions 탭 →
    Deploy Production (backend / Convex) → Run workflow → 브랜치 `main` 선택 → Run**.
    최초 오픈 배포, 실패한 배포 재시도, 커밋 없이 재배포할 때 사용한다.
    쿼리 시그니처가 깨지는 릴리스에서 **백엔드를 먼저** 올릴 때도 이 경로를 쓴다(아래 주의).
- **단계**: pnpm install → `npx convex deploy -y`. 그 외 단계는 없다.
- **동시 실행 방지**: `concurrency: production-deploy` 그룹. 진행 중인 실행은 취소하지 않고
  큐에 넣어 순서대로 실행한다. 마이그레이션 워크플로우도 같은 그룹이라
  Convex 배포와 마이그레이션이 절대 겹치지 않는다.

> ### ⚠️ 배포 순서 주의 (git 연동으로 바뀌면서 생긴 유일한 트레이드오프)
>
> 예전에는 한 워크플로우가 Convex → Vercel 순서로 배포해 **백엔드 선행**이 보장됐다.
> 이제 Convex(Actions)와 Vercel(git 연동)은 **서로 독립적으로** 시작하므로 순서가 강제되지 않는다.
> Convex 쿼리/뮤테이션 **시그니처가 바뀌는 릴리스**에서는 새 프론트가 잠깐(보통 수십 초)
> 구 백엔드를 호출할 수 있다.
>
> 실무 대응:
> 1. 보통 릴리스(시그니처 호환) — 그냥 머지하고 Convex 워크플로우가 끝나는지만 확인한다.
> 2. **시그니처가 깨지는 릴리스** — 프론트 변경을 `main`에 올리기 **전에**
>    Actions 탭에서 `Deploy Production (backend / Convex)` 를 `workflow_dispatch` 로 먼저 돌려
>    백엔드를 배포하고, 그다음 프론트 커밋을 push 한다.
> 3. 되돌릴 땐 Vercel 대시보드에서 이전 배포로 **Instant Rollback** 하는 게 가장 빠르다.

### 프로덕션 마이그레이션 (`.github/workflows/migrate-production.yml`)
- **트리거**: **수동 실행 전용**(`workflow_dispatch`). push/merge로는 절대 실행되지 않는다 —
  `wipeDemoData` 같은 파괴적 마이그레이션이 배포마다 돌면 안 되기 때문이다.
- **실행 방법**: Actions 탭 → **Run Convex Migration (production)** → Run workflow →
  브랜치 `main` → 입력값 채우기 → Run.
  | 입력 | 설명 |
  | --- | --- |
  | `migration` | 드롭다운에서 선택: `bootstrapAdmin`, `promoteAdmin`, `normalizeCohorts`, `backfillSearchText`, `rebuildRollups`, `wipeDemoData` |
  | `args` | JSON 인자. `bootstrapAdmin`: `{"name":"홍길동","phone":"01012345678"}` / `promoteAdmin`: `{"phone":"01012345678"}` / 그 외는 비움 |
  | `confirm` | `wipeDemoData`는 `WIPE`, `rebuildRollups`는 `REBUILD` 를 **직접 입력**해야 실행된다(기본값 없음). 그 외 마이그레이션에 값을 넣으면 실행 거부. |
- 내부적으로 `npx convex run migrations:<선택값> <args+confirm>` 을 실행한다
  (`CONVEX_DEPLOY_KEY`가 프로덕션 배포를 가리키므로 `--prod` 플래그는 불필요).
- 각 마이그레이션의 의미와 실행 순서는 아래 **§2-1 / §3** 참고.

### 필요 시크릿 (GitHub Settings > Secrets and variables > Actions > **Repository secrets**)
| 시크릿 | 용도 | 사용 워크플로우 |
| --- | --- | --- |
| `CONVEX_DEPLOY_KEY` | Convex 프로덕션 배포 키 (Convex 대시보드 → Settings → Deploy Keys → Generate Production Deploy Key) | deploy, migrate |

**이제 필요한 GitHub 시크릿은 `CONVEX_DEPLOY_KEY` 하나뿐이다.**

> `VERCEL_TOKEN` · `VERCEL_ORG_ID` · `VERCEL_PROJECT_ID` 세 시크릿은 **더 이상 어떤 워크플로우도
> 참조하지 않는다. 저장소 시크릿에서 지워도 된다**(남겨 둬도 무해하지만 지우는 편이 깔끔하다).
> Vercel은 git 연동으로 스스로 빌드하므로 CI가 Vercel 토큰을 들고 있을 이유가 없다.

> **참고**: `CONVEX_DEPLOY_KEY` 미설정 시 백엔드는 로컬 수동 배포(§2)로 올린다.

### 0-1. Vercel git 연동 — 운영자가 대시보드에서 1회만 하는 설정

프론트 배포 주체는 Vercel이다. 아래는 **한 번만** 하면 되는 작업이다.

1. **Vercel 대시보드 → 프로젝트 `rotconnector` → Settings → Git**
   → **Connect Git Repository** → GitHub → `contentscoin/ROTConnector` 선택.
   (Vercel GitHub App 설치 권한 요청이 뜨면 해당 저장소에 접근을 허용한다.
   새 프로젝트를 만들지 말고 **기존 `rotconnector` 프로젝트에 연결**해야
   프로덕션 도메인 `https://rotconnector.vercel.app` 이 그대로 유지된다.)
2. 같은 화면에서 **Production Branch = `main`** 으로 지정.
   (`main` 외 브랜치 push·PR은 Preview 배포가 된다. Preview가 필요 없으면
   Settings → Git → *Ignored Build Step* 이나 브랜치 설정으로 끌 수 있다.)
3. **Settings → Build & Deployment** 에서 저장소 `vercel.json` 과 일치하는지 확인.
   `vercel.json` 이 있는 값은 대시보드보다 우선하므로 **비워 두는 것이 정답**이다.
   | 항목 | 기대값 | 출처 |
   | --- | --- | --- |
   | Framework Preset | Vite | `vercel.json` `framework` |
   | Build Command | `pnpm build` | `vercel.json` `buildCommand` |
   | Output Directory | `dist` | `vercel.json` `outputDirectory` |
   | Install Command | (기본값 = 자동) | `pnpm-lock.yaml`(lockfileVersion 9.0)로 pnpm 9 자동 선택 |
   | Root Directory | (비움 = 저장소 루트) | — |
   | Node.js Version | **22.x** | 로컬/CI와 동일하게 맞춘다 |
4. **환경변수는 설정할 필요가 없다.** `VITE_CONVEX_URL` 은 커밋된 `.env.production`
   (`https://robust-ostrich-0.convex.cloud`)에 있고, `vite build` 는 기본 모드가 `production`
   이라 이 파일을 자동으로 읽어 번들에 인라인한다. Convex 클라이언트 URL은 공개값이다.
   - 선택 항목만 대시보드 환경변수가 필요할 수 있다: `VITE_SENTRY_DSN`(§7),
     `VITE_FIREBASE_*` 5개(§8). 지금은 `.env.production` 에서 주석 처리돼 있어 미설정 상태이며,
     `.env.production` 에 채우든 Vercel 환경변수(Production)에 넣든 결과는 같다
     (둘 다 빌드 타임 주입, 대시보드 값이 `.env.production` 값보다 우선).
5. 확인: `main` 에 아무 커밋이나 push → Vercel Deployments 에 새 Production 배포가
   자동으로 뜨고 `https://rotconnector.vercel.app` 이 갱신되는지 본다. → §5 스모크 테스트.

> 로컬 CLI(`vercel --prod`)는 **비상용 우회로**로만 남긴다(§4). 평시엔 쓰지 않는다.

<details>
<summary>(폐기) 이전 CLI 배포 방식 — VERCEL_PROJECT_NAME / VERCEL_SCOPE_SLUG / 접근 진단</summary>

`deploy.yml` 이 `vercel link` → `pull` → `build --prod` → `deploy --prebuilt --prod` 로
프론트를 직접 배포하던 방식은 **폐기됐다**. 프로젝트 이름·스코프 슬러그를 CI에서 맞추는 문제로
연속 실패했고, 그 원인을 없애기 위해 git 연동으로 전환했다.
`VERCEL_PROJECT_NAME` / `VERCEL_SCOPE_SLUG` / `VERCEL_CLI_VERSION` 워크플로우 `env:` 와
`Diagnose Vercel access` 단계(`vercel whoami` / `teams ls` / `project ls`)는 모두 제거됐다.
git 연동을 쓰는 한 이 설정들은 다시 필요하지 않다.

</details>

### 최초 프로덕션 오픈 순서

1. `CONVEX_DEPLOY_KEY` 시크릿 등록 + §0-1의 Vercel git 연동 1회 설정.
2. PR을 `main`에 머지 →
   Actions 의 `Deploy Production (backend / Convex)` 가 Convex를 배포하고,
   Vercel이 같은 push로 프론트를 배포한다.
   (커밋 없이 백엔드만 다시 올리려면 Actions 탭에서 수동 실행.)
3. 기존 데이터가 있으면 `Run Convex Migration (production)` 으로 §2-1 백필 2회 실행
   (`backfillSearchText` → `rebuildRollups` + `confirm: REBUILD`).
   빈 prod면 건너뛴다.
4. 시드/데모 데이터가 남아 있으면 `wipeDemoData` + `confirm: WIPE` 실행.
5. `bootstrapAdmin` 으로 최초 운영진 생성(§3) → 로그인 → §5 스모크 테스트.

---

## 1. 사전 점검 (코드)

- [ ] `pnpm build` 로컬 성공 (`tsc -b && vite build`)
- [ ] `.env.production`의 `VITE_CONVEX_URL`이 **프로덕션** Convex 배포를 가리키는지 확인
      (dev 배포 URL이 아닌지). Convex 클라이언트 URL은 공개값이라 커밋해도 안전.
- [ ] `.env.local`(dev `CONVEX_DEPLOYMENT` 토큰)은 `*.local` 규칙으로 gitignore됨 — 커밋 금지.

## 2. Convex 프로덕션 배포

**권장 경로는 GitHub Actions**(§0) — `Deploy Production (backend / Convex)` 워크플로우가
`main` push마다 Convex를 배포한다. 아래는 로컬에서 직접 배포할 때의 동등한 명령이다.

```bash
npx convex deploy            # 함수 + 스키마를 prod에 배포 (CI에서는 -y로 프롬프트 생략)
```

- 신규 테이블(`notifications`, `auditLogs`, `eventRsvps`, `announcements`,
  `counters`, `facetCounts`)은 **추가 전용**이라 배포 시 자동 생성됨.
- 레거시 cohort 표기 정규화가 필요한 기존 데이터가 있으면(1회):
  ```bash
  npx convex run migrations:normalizeCohorts
  ```
  Actions: `Run Convex Migration (production)` → `migration: normalizeCohorts`
  (`args`/`confirm` 비움).

### 2-1. 1000명 기준 확장 백필 (기존 데이터가 있을 때 **필수**)

회원 1000명 기준으로 데이터 접근을 바꿨다(자세한 설계는 `PLAN.md` §4).
검색은 `members.searchText` / `requests.searchText` **검색 인덱스**를 쓰고,
대시보드·통계·필터 칩 수치는 `counters` / `facetCounts` **롤업**에서 읽는다.
둘 다 쓰기 경로에서 유지되므로, **배포 이전에 들어간 기존 행은 1회 백필해야 한다.**
(백필 전에는 검색 결과가 비고 대시보드 수치가 0으로 보인다.)

빈 prod(신규 배포)라면 건너뛴다. 기존 데이터가 있으면 **순서대로** 1회 실행:

```bash
# 1) 검색 텍스트 + 프로필 완성률 캐시 백필 (members → requests 순서로 자동 진행)
npx convex run migrations:backfillSearchText --prod

# 2) counters / facetCounts 전량 재계산 (기존 롤업을 비우고 다시 집계)
npx convex run migrations:rebuildRollups '{"confirm":"REBUILD"}' --prod
```

Actions로 실행할 때(`Run Convex Migration (production)`, 위와 같은 순서로 2회):

| 순서 | `migration` | `args` | `confirm` |
| --- | --- | --- | --- |
| 1 | `backfillSearchText` | (비움) | (비움) |
| 2 | `rebuildRollups` | (비움) | `REBUILD` |

- 둘 다 `internalMutation`이라 클라이언트에서 호출 불가.
- 200건씩 처리하고 남으면 스케줄러로 자기 자신을 이어 호출한다(한 트랜잭션의
  읽기·쓰기 수를 고정). 실행 직후 바로 끝나지 않고 백그라운드로 완주하므로,
  Convex 대시보드의 Logs에서 마지막 단계(`phase: "notifications", done: true`)를 확인한다.
- **`rebuildRollups`는 언제든 다시 돌려도 안전하다**(전량 재계산이라 멱등).
  대시보드 수치가 실제와 어긋난 것 같으면 이걸 다시 실행하면 된다.
- `rebuildRollups`는 `backfillSearchText`가 하는 일(검색 텍스트·완성률)도 포함하므로,
  둘 중 하나만 돌릴 상황이면 `rebuildRollups`를 쓴다.

## 3. 최초 운영진 부트스트랩 (중요)

회원 등록은 운영진만 가능하므로 **빈 prod에선 로그인할 계정 자체가 없다.**
빈 DB 기준 1회 실행(upsert — 없으면 생성, 있으면 승격):

```bash
npx convex run migrations:bootstrapAdmin '{"name":"홍길동","phone":"01012345678"}' --prod
```

Actions: `migration: bootstrapAdmin`, `args: {"name":"홍길동","phone":"01012345678"}`,
`confirm` 비움.

- `internalMutation`이라 클라이언트에서 호출 불가(안전).
- 이미 회원이 있는 경우엔 `migrations:promoteAdmin '{"phone":"..."}'`도 사용 가능
  (Actions: `migration: promoteAdmin`, `args: {"phone":"01012345678"}`).
- 이후 추가 운영진은 운영진 콘솔(/admin → 회원)에서 토글로 지정.

**데모 데이터 초기화**: prod에 시드/데모 데이터가 있으면 오픈 전 삭제:
```bash
npx convex run migrations:wipeDemoData '{"confirm":"WIPE"}' --prod
```
(모든 앱 테이블 전 행 삭제. 2026-07-12 1회 실행됨 — 구 시드 14명 제거.)
Actions: `migration: wipeDemoData`, `args` 비움, `confirm: WIPE` **직접 입력**
(확인값이 정확히 일치하지 않으면 워크플로우가 실행 전에 실패한다).

> **prod에서 `seed:run` 실행 금지** — 데모 회원 13명·샘플 데이터를 만든다. 시드는 dev 전용.

## 4. 프론트엔드 배포 (Vercel git 연동)

- **기본 경로: `main` push → Vercel이 자동 배포.** 사람이 실행할 명령은 없다.
  대시보드 1회 설정은 §0-1, 배포 순서 주의는 §0 의 경고 박스 참고.
- Vercel은 저장소를 클론해 `pnpm install` → `pnpm build`(= `tsc -b && vite build`) 를 돌리고
  `dist` 를 서빙한다. 로컬 `pnpm build` 와 같은 명령·같은 lockfile·같은 `.env.production` 이므로
  결과물이 로컬 빌드와 동일하다(CI의 `--prebuilt` 업로드 경로는 더 이상 쓰지 않는다).
- `VITE_CONVEX_URL` 은 커밋된 `.env.production` 에서 온다 — Vercel 환경변수 설정 불필요(§0-1 4번).
- **비상용 우회로**(git 연동이 끊겼거나 대시보드 빌드가 막혔을 때만):
  ```
  vercel --prod --yes                                    # 개인 계정 기본 스코프
  vercel --prod --yes --scope jakes-projects-0ab50f91    # 위가 "Project not found" 면 스코프 지정
  ```
  → 프로덕션 별칭 `https://rotconnector.vercel.app` 로 alias.
- SPA rewrite는 `vercel.json`에서 **확장자 없는 경로만** index.html로 보냄
  (`/((?!.*\.).*)`) — manifest/아이콘/정적 자산은 그대로 제공.

## 5. 배포 후 스모크 테스트

- [ ] `/manifest.webmanifest`, `/apple-touch-icon.png`, `/icons/*`, `/robots.txt`, `/sitemap.xml` 이
      200(HTML 아님)으로 로드 — PWA 설치 + 색인 가능
- [ ] 브라우저 콘솔에 **CSP 위반 없음**(`vercel.json`의 Content-Security-Policy).
      Convex WSS·FCM(googleapis/gstatic)·Sentry는 허용 목록에 있음 —
      외부 스크립트/이미지 호스트를 새로 추가하면 CSP도 함께 갱신해야 한다.
- [ ] 딥링크 새로고침 동작: `/members/<id>`, `/events/<id>`, `/requests/<id>` 직접 진입 시 404 아님
- [ ] phone 클레임 → 로그인 → 프로필 작성 → 운영진 승인(pending→active) 흐름
- [ ] 도움요청 등록 → 운영진 매칭(propose)·완료(complete) → 작성자/헬퍼 **알림 수신**(헤더 벨)
- [ ] 교류 신청 → 수락 시에만 상호 연락처 노출, 알림 수신
- [ ] 행사 등록 → 전체 회원 알림 + 참석/관심 RSVP + 상세 참석자 명단
- [ ] 정지(suspended) 처리 시 해당 계정 즉시 로그아웃·디렉토리/피드에서 제외
- [ ] **1000명 기준 확장 확인**(§2-1 백필 후):
  - [ ] `/members` 검색·필터 후 목록 하단 **"더 보기"** 로 다음 페이지가 이어짐
        (도움요청·커뮤니티·알림·행사·교류·운영진 회원표도 동일)
  - [ ] 필터 칩(기수·학교·업종·지역·도움분야)에 값이 채워짐 → `facetCounts` 롤업 정상
  - [ ] `/admin` 대시보드·통계 수치가 실제와 일치 → `counters` 롤업 정상.
        어긋나면 `migrations:rebuildRollups` 재실행
  - [ ] 회원 등록·상태 변경·요청 등록·교류 수락 직후 위 수치가 즉시 반영됨(쓰기 시 증감)
  - [ ] 운영진 CSV 내보내기가 전체 회원을 담아 내려옴(커서로 이어 받음)
  - [ ] 회원 검색어에 전화번호를 넣으면 **완전일치만** 조회됨(부분 일치 미지원 —
        공개 검색 인덱스에 phone을 넣지 않는 정책)

## 6. 모바일 릴리스 (선택)

```bash
pnpm build && npx cap sync
npx cap open ios     # / android
```

## 7. 에러 리포팅 (Sentry) 설정 — 선택

`src/lib/sentry.ts`는 `VITE_SENTRY_DSN`이 있을 때만 초기화된다(미설정 시 완전 no-op이라
앱은 정상 동작하고 네트워크 요청도 발생하지 않음).

1. Sentry에서 프로젝트 생성(플랫폼: React) → **DSN** 복사.
2. `.env.production`의 주석 처리된 줄을 해제해 채운다(DSN은 공개값이라 커밋 가능):
   ```
   VITE_SENTRY_DSN=https://<publicKey>@o0.ingest.sentry.io/<projectId>
   ```
   Vercel 대시보드 환경변수로 넣어도 동일하게 동작한다(빌드 타임에 주입됨).
3. 재배포. 수집 항목: 미처리 예외 + `captureError()` 호출 + 성능 트레이스(샘플링 20%).
4. `vercel.json`의 CSP `connect-src`에 `https://*.sentry.io`가 이미 허용돼 있다.
   자체 호스팅/커스텀 도메인 DSN을 쓰면 해당 호스트를 CSP에 추가해야 한다.

> 소스맵은 `hidden` 모드로 생성돼 `dist/assets/*.map`에 남는다(브라우저에 노출 안 됨).
> Sentry에 업로드하려면 릴리스마다 `sentry-cli sourcemaps upload dist/assets` 사용.

---

## 8. 푸시 알림 (FCM) 설정

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
4. 재배포(백엔드: `main` push로 Actions 워크플로우 / 프론트: 같은 push로 Vercel 자동 빌드).
   회원이 `/notifications`의 **"브라우저 푸시 알림 켜기"** 로 권한 허용 → 디바이스 토큰이 `pushTokens`에 등록됨.

- 인앱 알림 8종 전부 푸시로도 전달된다(교류·매칭·도움요청·행사·가입승인).
- 무효/만료 토큰은 발송 시 자동 정리(404/400).
- 행사 등록 알림 팬아웃은 스케줄러 기반 페이지 처리(100명/배치, `events.fanoutCreated`)라
  회원 수와 무관하게 등록이 즉시 완료된다.
- **푸시 발송은 배치로 묶여 있다** — 팬아웃 페이지 1개당 `push.sendBatch` 액션 1개만
  예약되고 OAuth 액세스 토큰도 배치당 1회만 발급한다. 회원 1000명 기준으로
  액션 10개 · 토큰 발급 10회다(이전 구현은 수신자마다 액션 1개 + 토큰 1회라
  액션 1000개 · 토큰 1000회였다).
  1:1 알림(교류·매칭 등)은 그대로 `push.sendToUser` 단건 경로를 쓴다.

### 네이티브(iOS/Android) 푸시 — 후속

백엔드(`pushTokens`/`push.register`/발송)는 플랫폼 무관(FCM 토큰만 있으면 됨)이라 그대로 재사용.
네이티브는 `@capacitor/push-notifications` 설치 + APNs(iOS)/`google-services.json`(Android)
설정 후, 플러그인의 registration 토큰을 `api.push.register({ token, fcmToken, platform: 'ios'|'android' })`
로 보내면 된다. (Apple Developer/네이티브 빌드 환경 필요 — 별도 작업)

## 미구현 (외부 자격증명 필요)

- 카카오 알림톡 — 자격증명 확보 후 연동.
- OTP 로그인 — 현재 phone 클레임 파일럿 인증. (의도적 보류)
