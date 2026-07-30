import { internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'

const DAY = 24 * 60 * 60 * 1000

// 데모 시드. `npx convex run seed:run` 으로 실행.
// 이미 회원이 있으면 건너뜀(중복 방지).
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('members').first()
    if (existing) {
      return { skipped: true, reason: '이미 회원 데이터가 있습니다.' }
    }
    const now = Date.now()

    // cohort는 정규화된 숫자 문자열("35")로 저장 — 표시는 프론트 formatCohort("35기").
    // university는 학군단 보유 실제 대학. 동기/동문 매칭 데모를 위해 일부 중복 배치.
    const seedMembers = [
      {
        name: '김도현',
        cohort: '35',
        university: '한양대',
        phone: '01011110000',
        company: '알비연 사무국',
        title: '사무총장',
        industry: ['협회운영'],
        region: '서울',
        intro: '알비연 운영진. 회원 연결과 행사 운영을 총괄합니다.',
        helpOffer: ['회원 연결', '행사 기획'],
        helpNeed: [],
        isAdmin: true,
        contributionScore: 40,
      },
      {
        name: '이상훈',
        cohort: '36',
        university: '고려대',
        phone: '01022220001',
        company: '(주)넥스트소프트',
        title: '대표',
        industry: ['IT/SaaS'],
        region: '서울',
        intro: 'B2B SaaS 개발사. 업무 자동화 솔루션을 공급합니다.',
        products: '업무 자동화 SaaS 「넥스트플로우」 (결재·정산 자동화)',
        customers: '중견 제조·물류 기업 IT/경영지원 부서',
        helpOffer: ['SI/개발 외주', '기술 자문'],
        helpNeed: ['엔터프라이즈 영업 연결'],
        contributionScore: 32,
      },
      {
        name: '박지원',
        cohort: '34',
        university: '성균관대',
        phone: '01022220002',
        company: '한결제조',
        title: '전무',
        industry: ['제조'],
        region: '경기',
        intro: '정밀 부품 제조. OEM/ODM 가능.',
        products: '자동차·의료기기용 정밀 가공 부품 (OEM/ODM)',
        customers: '완성차 1차 벤더, 의료기기 제조사',
        helpOffer: ['생산 위탁', '공장 견학'],
        helpNeed: ['해외 바이어 연결'],
        contributionScore: 28,
      },
      {
        name: '정민재',
        cohort: '38',
        university: '동국대',
        phone: '01022220003',
        company: '민재세무회계',
        title: '세무사',
        industry: ['금융/세무'],
        region: '서울',
        intro: '스타트업·중소기업 세무 자문 전문.',
        products: '법인 세무기장·세무조정·절세 컨설팅',
        customers: '스타트업·중소기업 200여 곳',
        helpOffer: ['세무 상담', '절세 컨설팅'],
        helpNeed: ['신규 고객 소개'],
        contributionScore: 24,
      },
      {
        name: '최영후',
        cohort: '37',
        university: '한양대',
        phone: '01022220004',
        company: '영후법률사무소',
        title: '변호사',
        industry: ['법률'],
        region: '서울',
        intro: '계약·분쟁·IP 자문.',
        products: '계약서 검토·분쟁 대응·IP(상표/특허) 자문',
        customers: 'IT 스타트업, 중소 제조·유통사',
        helpOffer: ['법률 자문', '계약서 검토'],
        helpNeed: [],
        contributionScore: 22,
      },
      {
        name: '한승우',
        cohort: '39',
        university: '건국대',
        phone: '01022220005',
        company: '브릿지마케팅',
        title: '대표',
        industry: ['마케팅'],
        region: '서울',
        intro: '퍼포먼스 마케팅·브랜딩 에이전시.',
        products: '퍼포먼스 광고 운영·브랜드 캠페인 기획',
        customers: 'F&B 프랜차이즈, 이커머스 브랜드',
        helpOffer: ['마케팅 전략', '광고 운영'],
        helpNeed: ['디자인 인력 채용'],
        contributionScore: 18,
      },
      {
        name: '오세진',
        cohort: '36',
        university: '고려대',
        phone: '01022220006',
        company: '세진물류',
        title: '대표',
        industry: ['물류'],
        region: '인천',
        intro: '수출입 통관·3PL 물류.',
        products: '수출입 통관 대행·3PL 풀필먼트',
        customers: '이커머스 셀러, 수출 제조기업',
        helpOffer: ['통관 자문', '물류 견적'],
        helpNeed: ['창고 부지 임대'],
        contributionScore: 15,
      },
      {
        name: '강태민',
        cohort: '40',
        university: '부산대',
        phone: '01022220007',
        company: '태민에프앤비',
        title: '대표',
        industry: ['F&B'],
        region: '부산',
        intro: '프랜차이즈 외식 브랜드 운영.',
        products: '외식 프랜차이즈 2개 브랜드 (직영 4·가맹 30개점)',
        customers: '가맹점주, 일반 소비자',
        helpOffer: ['상권 분석', '창업 멘토링'],
        helpNeed: ['투자 유치'],
        contributionScore: 12,
      },
      {
        name: '윤재호',
        cohort: '35',
        university: '영남대',
        phone: '01022220008',
        company: '재호부동산개발',
        title: '이사',
        industry: ['부동산'],
        region: '경기',
        intro: '상업용 부동산 개발·중개.',
        helpOffer: ['부동산 자문', '사무실 중개'],
        helpNeed: ['시행 자금 파트너'],
        contributionScore: 10,
      },
      {
        name: '서준영',
        cohort: '41',
        university: '전남대',
        phone: '01022220009',
        company: '준영벤처스',
        title: '심사역',
        industry: ['금융/투자'],
        region: '서울',
        intro: '초기 스타트업 투자.',
        helpOffer: ['투자 검토', 'IR 멘토링'],
        helpNeed: ['딜소싱'],
        contributionScore: 20,
      },
      {
        name: '임현수',
        cohort: '38',
        university: '충남대',
        phone: '01022220010',
        company: '현수메디케어',
        title: '대표',
        industry: ['의료/헬스'],
        region: '대전',
        intro: '의료기기 유통.',
        products: '재활·진단 의료기기 유통 (병·의원 납품)',
        customers: '전국 병·의원 150여 곳',
        helpOffer: ['병원 네트워크', '인허가 자문'],
        helpNeed: ['생산 파트너'],
        contributionScore: 8,
      },
      {
        name: '조성배',
        cohort: '37',
        university: '경북대',
        phone: '01022220011',
        company: '성배에듀',
        title: '대표',
        industry: ['교육'],
        region: '대구',
        intro: '기업 교육·리더십 강의.',
        helpOffer: ['임직원 교육', '강연'],
        helpNeed: ['B2B 영업'],
        contributionScore: 6,
      },
      {
        name: '신광호',
        cohort: '39',
        university: '건국대',
        phone: '01022220012',
        company: '광호컨설팅',
        title: '대표',
        industry: ['컨설팅'],
        region: '서울',
        intro: '경영전략·정부지원사업 컨설팅.',
        helpOffer: ['정부지원사업', '사업계획서'],
        helpNeed: ['협업 파트너'],
        contributionScore: 14,
      },
      {
        name: '문대성',
        cohort: '42',
        university: '성균관대',
        phone: '01022220013',
        company: '대성유통',
        title: '대표',
        industry: ['유통'],
        region: '서울',
        intro: '온라인 커머스 유통.',
        products: '생활용품·소형가전 온라인 유통',
        customers: '쿠팡·네이버 스마트스토어 입점 셀러',
        helpOffer: ['온라인 입점', '셀러 연결'],
        helpNeed: ['물류 파트너'],
        contributionScore: 4,
        status: 'pending' as const,
      },
    ]

    const ids: Record<string, Id<'members'>> = {}
    for (let i = 0; i < seedMembers.length; i++) {
      const m = seedMembers[i]
      const id = await ctx.db.insert('members', {
        name: m.name,
        cohort: m.cohort,
        university: m.university,
        phone: m.phone,
        company: m.company,
        title: m.title,
        industry: m.industry,
        region: m.region,
        intro: m.intro,
        products: m.products,
        customers: m.customers,
        helpOffer: m.helpOffer,
        helpNeed: m.helpNeed,
        links: [],
        isAdmin: m.isAdmin ?? false,
        status: m.status ?? 'active',
        contributionScore: m.contributionScore,
        createdAt: now - (seedMembers.length - i) * DAY,
      })
      ids[m.name] = id
    }

    // 요청
    const reqs = [
      {
        author: '강태민',
        title: '부산 외식 브랜드 시리즈A 투자자 연결 요청',
        body: '프랜차이즈 2호점 오픈 후 시리즈A를 준비 중입니다. 외식/소비재에 관심있는 투자자를 소개받고 싶습니다.',
        category: '투자',
        tags: ['투자유치', 'F&B'],
        region: '부산',
        urgency: 'high' as const,
        status: 'matching' as const,
        ago: 2,
      },
      {
        author: '이상훈',
        title: '엔터프라이즈 영업 채널 소개 부탁드립니다',
        body: '대기업 대상 SaaS 영업 채널이 필요합니다. 구매/IT 의사결정권자 연결 가능하신 분 찾습니다.',
        category: '영업',
        tags: ['B2B', '영업연결'],
        region: '서울',
        urgency: 'normal' as const,
        status: 'open' as const,
        ago: 1,
      },
      {
        author: '한승우',
        title: '시니어 디자이너 채용 추천 구합니다',
        body: '브랜딩 디자이너(경력 5년+) 채용 중입니다. 추천 환영합니다.',
        category: '채용',
        tags: ['채용', '디자인'],
        region: '서울',
        urgency: 'normal' as const,
        status: 'open' as const,
        ago: 3,
      },
      {
        author: '박지원',
        title: '동남아 바이어 연결 희망',
        body: '정밀부품 수출을 위해 베트남/인니 바이어를 찾고 있습니다.',
        category: '해외',
        tags: ['수출', '바이어'],
        region: '경기',
        urgency: 'normal' as const,
        status: 'open' as const,
        ago: 5,
      },
      {
        author: '임현수',
        title: '의료기기 OEM 생산 파트너 소개',
        body: '소형 의료기기 OEM 생산이 가능한 제조사를 찾습니다.',
        category: '제휴',
        tags: ['OEM', '제조'],
        region: '대전',
        urgency: 'low' as const,
        status: 'connected' as const,
        ago: 8,
      },
      {
        author: '조성배',
        title: '임직원 리더십 교육 도입 기업 추천',
        body: '리더십/조직문화 교육 도입을 고려하는 회원사가 있다면 연결 부탁드립니다.',
        category: '영업',
        tags: ['교육', 'B2B'],
        region: '대구',
        urgency: 'low' as const,
        status: 'open' as const,
        ago: 6,
      },
    ]

    const reqIds: Record<string, Id<'requests'>> = {}
    for (const r of reqs) {
      const id = await ctx.db.insert('requests', {
        authorId: ids[r.author],
        title: r.title,
        body: r.body,
        category: r.category,
        tags: r.tags,
        region: r.region,
        urgency: r.urgency,
        status: r.status,
        createdAt: now - r.ago * DAY,
      })
      reqIds[r.title] = id
    }

    // 매칭 (강태민 요청 ↔ 서준영 투자심사역, 운영진 김도현 중개)
    await ctx.db.insert('matches', {
      requestId: reqIds['부산 외식 브랜드 시리즈A 투자자 연결 요청'],
      helperId: ids['서준영'],
      brokeredBy: ids['김도현'],
      status: 'accepted',
      note: '서준영 심사역 IR 미팅 일정 조율 중',
      createdAt: now - 1 * DAY,
    })
    // 완료된 매칭 (의료기기 OEM ↔ 박지원 제조, 연결완료)
    await ctx.db.insert('matches', {
      requestId: reqIds['의료기기 OEM 생산 파트너 소개'],
      helperId: ids['박지원'],
      brokeredBy: ids['김도현'],
      status: 'done',
      note: '샘플 발주 완료',
      createdAt: now - 7 * DAY,
    })

    // 기여 이력
    await ctx.db.insert('contributions', {
      memberId: ids['박지원'],
      type: 'consult',
      points: 10,
      note: '의료기기 OEM 연결 완료',
      createdAt: now - 6 * DAY,
    })
    await ctx.db.insert('contributions', {
      memberId: ids['김도현'],
      type: 'intro',
      points: 5,
      note: '중개',
      createdAt: now - 6 * DAY,
    })

    // 1:1 교류 신청 샘플
    // accepted 1건: 이상훈(고려대 36) ↔ 오세진(고려대 36) — 동기·동문 커피챗, 연락처 공개 데모
    await ctx.db.insert('connections', {
      fromId: ids['이상훈'],
      toId: ids['오세진'],
      message:
        '수출 제조기업 대상 물류 자동화 SaaS 도입 사례가 궁금합니다. 같은 36기 동기라 더 반갑습니다. 커피챗 한번 부탁드립니다.',
      topic: '커피챗',
      status: 'accepted',
      respondedAt: now - 1 * DAY,
      createdAt: now - 2 * DAY,
    })
    // pending 1건: 강태민 → 김도현(운영진) — 데모 로그인 시 받은 신청 뱃지 노출용
    await ctx.db.insert('connections', {
      fromId: ids['강태민'],
      toId: ids['김도현'],
      message:
        '하반기 포럼에서 외식 브랜드 사업 발표 기회를 얻고 싶습니다. 발표 신청 절차 소개 부탁드립니다.',
      topic: '소개 요청',
      status: 'pending',
      createdAt: now - 1 * DAY,
    })
    // pending 1건: 한승우 → 문대성 — 보낸 신청 대기 상태 데모
    await ctx.db.insert('connections', {
      fromId: ids['한승우'],
      toId: ids['문대성'],
      message:
        '온라인 유통 브랜드의 퍼포먼스 마케팅 협업을 제안드리고 싶습니다. 짧게 통화 가능하실까요?',
      topic: '협업 제안',
      status: 'pending',
      createdAt: now - 3 * DAY,
    })

    // 행사 / 후원
    await ctx.db.insert('events', {
      title: '알비연 2026 상반기 정기 비즈니스 포럼',
      kind: 'event',
      body: '회원사 사업 발표 + 네트워킹. 발표 희망 회원은 운영진에게 신청.',
      date: '2026-06-20',
      place: '서울 강남 코엑스',
      host: '알비연 사무국',
      status: 'upcoming',
      createdAt: now - 4 * DAY,
    })
    await ctx.db.insert('events', {
      title: '하반기 후원사 모집 (부스/발표 슬롯)',
      kind: 'sponsor',
      body: '공식 협찬사 3개사 모집. 부스 + 발표 기회 제공.',
      date: '2026-09-01',
      place: '미정',
      host: '알비연 사무국',
      status: 'upcoming',
      createdAt: now - 3 * DAY,
    })

    // 검색 인덱스(searchText)·집계 롤업(counters/facetCounts)·회원 파생 캐시는
    // 시드에서 손으로 채우지 않고 재계산 마이그레이션에 위임한다 —
    // 백필 로직이 한 곳(migrations.rebuildRollups)에만 있도록.
    await ctx.scheduler.runAfter(0, internal.migrations.rebuildRollups, {
      confirm: 'REBUILD' as const,
    })

    return {
      skipped: false,
      members: seedMembers.length,
      requests: reqs.length,
      connections: 3,
      // 운영진 로그인 phone은 반환에 노출하지 않음(로그는 convex 콘솔에 남음).
      admin: { name: '김도현' },
    }
  },
})
