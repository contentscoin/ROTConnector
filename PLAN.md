# ROTConnector — 알비연 링크 · 최종 기획안

> 선후배의 신뢰를 비즈니스 연결로.
> ROTC 비즈니스연합회(알비연) 회원의 도움요청 · 사업소개 · 행사 · 후원 · 협업 기회를 한곳에.

---

## 0. 한 줄 정의

**커뮤니티 앱이 아니라 "신뢰 기반 비즈니스 연결 OS".**
카카오톡 안에서 너무 빨리 흘러가버리는 "누가 어떤 도움을 줄 수 있는가"를
**다시 찾을 수 있게** 구조화한다.

---

## 1. 문제 / 강점

- **강점**: 이미 형성된 선후배 신뢰, 빠른 반응성.
- **약점**: 정보가 카톡에서 휘발됨. 누가 무엇을 도울 수 있는지 재탐색 불가.
- **해법**: 프로필·요청·연결 이력을 영속 저장하고, 운영진이 중개를 빠르게 처리.

---

## 2. MVP 범위 (우선 개발 3종)

화려한 SNS가 아니라 아래 3개가 먼저 "돌아가게" 한다.

1. **회원 프로필 디렉토리** — 업종/지역/도움태그로 검색·필터, 사업 소개.
2. **도움요청 게시판** — 요청 등록 → 상태(접수/매칭중/연결완료) 추적.
3. **운영진 중개 대시보드** — 요청-회원 매칭, 연결 기록, 기여 인정 관리.

이 3개가 돌면 카톡방 불편이 줄어든다. 이후 비즈니스룸 · 행사/후원 · AI 매칭을 붙인다.

---

## 3. 기술 스택 (확정)

| 영역 | 선택 | 비고 |
|------|------|------|
| 프론트 | **Vite + React 19 + TypeScript** | SPA |
| 스타일 | **Tailwind CSS v4** | 모바일 퍼스트, 디자인 토큰 |
| 라우팅 | React Router v7 | |
| 백엔드/DB | **Convex** | 실시간 쿼리, 서버리스 함수, 타입 안전 |
| 배포 | **Vercel** | 프론트 정적 + Convex 클라우드 백엔드 |
| 모바일 | **Capacitor** | 동일 웹앱을 iOS/Android 래핑 |
| 아이콘 | lucide-react | |

**데이터 흐름**: Vercel(정적 SPA) → `VITE_CONVEX_URL` → Convex Cloud(쿼리/뮤테이션, 실시간 구독).

---

## 4. 데이터 모델 (Convex schema)

- **members** — 회원 프로필
  `name, cohort(기수), phone, company, role, industry[], region, intro, helpOffer[], helpNeed[], links[], isAdmin, status(active/pending), contributionScore, createdAt`
- **requests** — 도움요청
  `authorId, title, body, category, tags[], region, status(open/matching/connected/closed), urgency, createdAt`
- **matches** — 중개/연결 기록 (운영진)
  `requestId, helperId, brokeredBy, status(proposed/accepted/connected/done), note, createdAt`
- **contributions** — 기여 인정
  `memberId, type(intro/consult/sponsor/event/onboarding), points, refId, note, createdAt`
- **events** — 행사/후원 (Phase 2)
  `title, kind(event/sponsor), date, place, body, host, status, createdAt`
- **sessions** — 파일럿 경량 세션 (phone 클레임)

### 인덱스
- members: by_phone, by_industry, by_region, by_status
- requests: by_status, by_author, by_category
- matches: by_request, by_helper
- contributions: by_member

---

## 5. 인증 (파일럿 등급, 교체 가능)

- 1단계 "수동 MVP"에 맞춘 **경량 phone 클레임 세션**:
  운영진이 등록한 회원 phone으로 본인 프로필을 claim → localStorage 세션 토큰.
- `isAdmin` 플래그로 운영진 대시보드 접근 제어.
- **Phase 2 하드닝**: Convex Auth(Password/OTP) 또는 카카오 OAuth로 교체.
  인증 레이어는 `convex/auth.ts` 한 곳에 격리해 교체 비용 최소화.

---

## 6. 화면 구성

| 경로 | 화면 | MVP |
|------|------|-----|
| `/` | 홈(카피 + 4버튼 + 최근 요청/추천 회원) | ✅ |
| `/members` | 회원 디렉토리 (검색·필터) | ✅ |
| `/members/:id` | 회원 상세 / 사업 소개 | ✅ |
| `/requests` | 도움요청 게시판 | ✅ |
| `/requests/new` | 요청 등록 | ✅ |
| `/requests/:id` | 요청 상세 + 매칭 현황 | ✅ |
| `/me` | 내 프로필 편집 / 내 사업 소개 | ✅ |
| `/admin` | 운영진 중개 대시보드 | ✅ |
| `/events` | 행사/후원 보기 | Phase 2 |
| `/login` | phone 클레임 로그인 | ✅ |

**첫 화면 카피**
> 선후배의 신뢰를 비즈니스 연결로.
> 알비연 링크는 ROTC 비즈니스연합회 회원의 도움요청·사업소개·행사·후원·협업 기회를 한곳에 정리합니다.
주요 버튼: 도움요청 등록 / 회원 찾기 / 내 사업 소개 / 행사·후원 보기

---

## 7. 기여 인정 시스템

연결이 일어날 때마다 기여를 적립(자율 문화 강화):
- 소개 기여 / 상담 기여 / 후원 기여 / 행사 운영 기여 / 신규회원 온보딩 기여
- 운영진이 연결 완료 처리 시 helper에게 `contributions` 자동 적립 → `contributionScore`.

---

## 8. 90일 로드맵 (기획 원안 반영)

- **0–30일 수동 MVP**: 프로필 100명, 요청 게시판, 운영진 중개 프로세스, 카톡 공유 카드, 월간 리포트.
  - 성공: 회원 100 / 요청 30 / 연결 10 / 행사·후원 2건+
- **31–60일 매칭 고도화**: 태그 정규화, 추천 회원 자동, 프로필 미작성 리마인드, 운영진 대시보드.
  - 성공: 회원 200 / 요청 70 / 연결 30 / 프로필 완성률 70%
- **61–90일 AI 보조·성과 공개**: 요청 요약 AI, 소개문 생성 AI, 월간 리포트 자동화, 우수 사례 공개, 비즈니스룸/프로모션.
  - 성공: 회원 300 / 연결 60 / 행사 누적 150명 / 후원 실적 집계

---

## 9. 수익모델 후보 (장기, 초기엔 참여율·신뢰 우선)

1. 정회원 회비 포함형 (운영비 회비 포함)
2. 프리미엄 비즈니스 프로필 (제안서/영상/카탈로그/추천 사례)
3. 행사·세미나 스폰서 슬롯
4. B2B 제휴 성과 후원 (수수료보다 자율 후원·기여금 방식)

---

## 10. 빌드 / 배포 순서

1. 스캐폴딩(Vite+React+TS) ✅
2. Tailwind v4 · 라우팅 · 디자인 토큰
3. Convex schema + 함수 + 시드 데이터
4. Convex codegen → 클라우드 deployment
5. 앱 셸 · 공유 UI 키트 · 3대 MVP 화면 + 보조 화면
6. 멀티에이전트 리뷰/QA(버그·보안·a11y·Convex 베스트프랙티스·Capacitor)
7. 로컬 검증 → **Vercel 배포(최종)** → Convex prod 연결
8. Capacitor 설정(iOS/Android 래핑 준비)

---

## 11. 비고

- 1단계는 "수동 MVP" — 운영진이 직접 중개. 앱은 그 과정을 **기록·가시화**하는 데 집중.
- AI 매칭/요약은 Phase 3. MVP는 신뢰할 수 있는 데이터 구조와 운영 흐름이 핵심.
