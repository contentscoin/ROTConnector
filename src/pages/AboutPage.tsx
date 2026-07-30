import { Link } from 'react-router-dom'
import {
  Info,
  Users,
  Handshake,
  CalendarDays,
  Search,
  PlusCircle,
  ChevronLeft,
  Mail,
} from 'lucide-react'
import { Card, PageHeader, SectionHeader } from '../components/ui'

const steps = [
  {
    icon: Users,
    title: '1. 회원 가입',
    desc: '전화번호로 간편 가입 후 프로필을 완성하세요. 기수, 업종, 줄 수 있는 도움을 입력하면 동기/동문을 찾을 수 있습니다.',
  },
  {
    icon: Search,
    title: '2. 회원 검색',
    desc: '업종, 지역, 도움분야로 필요한 회원을 찾고 교류 신청을 보내보세요.',
  },
  {
    icon: PlusCircle,
    title: '3. 도움요청 등록',
    desc: '투자, 영업, 채용 등 구체적인 도움이 필요하면 요청을 올려주세요. 운영진이 적합한 회원을 매칭해드립니다.',
  },
  {
    icon: Handshake,
    title: '4. 연결 & 기여',
    desc: '연결이 성사되면 양쪽에 기여 점수가 적립됩니다. 많이 도울수록 랭킹이 올라갑니다.',
  },
  {
    icon: CalendarDays,
    title: '5. 행사 & 후원',
    desc: '정기 모임, 세미나, 후원 이벤트에 참여하며 네트워크를 넓혀보세요.',
  },
]

export function AboutPage() {
  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-semibold text-navy-500"
      >
        <ChevronLeft className="size-4" />
        홈으로
      </Link>

      <PageHeader
        eyebrow="ROTC 비즈니스연합회"
        title="알비연 링크 소개"
        subtitle="선후배의 신뢰를 비즈니스 연결로."
        icon={<Info className="size-5" />}
      />

      <Card className="space-y-3 p-5">
        <p className="text-[15px] leading-relaxed text-navy-700">
          <strong className="text-navy-900">알비연 링크</strong>는 ROTC
          비즈니스연합회 회원 간 신뢰 기반의 비즈니스 연결 플랫폼입니다.
        </p>
        <p className="text-[15px] leading-relaxed text-navy-700">
          같은 ROTC 출신이라는 공통 분모를 바탕으로, 투자/영업/채용/법률 등
          실질적인 도움을 주고받을 수 있는 연결을 만들어 갑니다.
        </p>
      </Card>

      <section>
        <SectionHeader title="이용 방법" />
        <div className="space-y-3">
          {steps.map((s) => {
            const Icon = s.icon
            return (
              <Card key={s.title} className="flex gap-3 p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy-100 text-navy-700">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-navy-900">{s.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-navy-600">
                    {s.desc}
                  </p>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      <section>
        <SectionHeader title="문의" />
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold-400/20 text-gold-600">
              <Mail className="size-5" />
            </div>
            <div>
              <p className="font-bold text-navy-900">ROTC 비즈니스연합회 운영진</p>
              <p className="text-sm text-navy-500">
                플랫폼 관련 문의는 운영진에게 연락해 주세요.
              </p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  )
}
