import { Link } from 'react-router-dom'
import { ChevronLeft, FileText } from 'lucide-react'
import { Card, PageHeader, SectionHeader } from '../components/ui'

export function TermsPage() {
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
        title="이용약관"
        subtitle="알비연 링크 서비스 이용약관"
        icon={<FileText className="size-5" />}
      />

      <section>
        <SectionHeader title="제1조 (목적)" />
        <Card className="space-y-3 p-5">
          <p className="text-[15px] leading-relaxed text-navy-700">
            본 약관은 ROTC 비즈니스연합회(이하 "연합회")가 운영하는 알비연 링크
            서비스(이하 "서비스")의 이용조건 및 절차, 회원과 연합회의 권리와 의무,
            기타 필요한 사항을 규정함을 목적으로 합니다.
          </p>
        </Card>
      </section>

      <section>
        <SectionHeader title="제2조 (서비스 설명)" />
        <Card className="space-y-3 p-5">
          <p className="text-[15px] leading-relaxed text-navy-700">
            서비스는 ROTC 출신 비즈니스 종사자 간의 신뢰 기반 비즈니스 연결
            플랫폼으로, 도움요청, 사업소개, 행사/후원 정보 공유, 회원 간 교류 등의
            기능을 제공합니다.
          </p>
        </Card>
      </section>

      <section>
        <SectionHeader title="제3조 (회원 자격)" />
        <Card className="space-y-3 p-5">
          <p className="text-[15px] leading-relaxed text-navy-700">
            서비스는 ROTC 비즈니스연합회 회원으로 승인된 자에 한하여 이용할 수
            있습니다. 회원 가입 시 ROTC 출신 여부 및 연합회 회원 자격을 확인할 수
            있는 정보를 제공해야 합니다.
          </p>
        </Card>
      </section>

      <section>
        <SectionHeader title="제4조 (회원의 의무)" />
        <Card className="space-y-3 p-5">
          <ul className="list-disc space-y-2 pl-4 text-[15px] leading-relaxed text-navy-700">
            <li>회원은 정확한 정보를 등록하고 최신 상태로 유지해야 합니다.</li>
            <li>
              타인의 정보를 도용하거나 허위 정보를 등록하는 행위를 금지합니다.
            </li>
            <li>
              서비스를 통해 얻은 타 회원의 개인정보를 본인의 사전 동의 없이
              외부에 유출하거나 상업적으로 이용할 수 없습니다.
            </li>
            <li>
              서비스의 운영을 방해하거나 부정한 목적으로 이용하는 행위를
              금지합니다.
            </li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionHeader title="제5조 (콘텐츠 가이드라인)" />
        <Card className="space-y-3 p-5">
          <p className="text-[15px] leading-relaxed text-navy-700">
            회원이 등록하는 모든 콘텐츠(도움요청, 사업소개, 게시글 등)는 다음
            기준을 준수해야 합니다:
          </p>
          <ul className="list-disc space-y-2 pl-4 text-[15px] leading-relaxed text-navy-700">
            <li>불법적이거나 비윤리적인 내용을 포함하지 않을 것</li>
            <li>타인의 명예를 훼손하거나 사생활을 침해하지 않을 것</li>
            <li>허위/과장 광고나 스팸성 내용을 포함하지 않을 것</li>
            <li>정치적 목적의 홍보를 포함하지 않을 것</li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionHeader title="제6조 (서비스 제한)" />
        <Card className="space-y-3 p-5">
          <p className="text-[15px] leading-relaxed text-navy-700">
            연합회는 다음의 경우 서비스 이용을 제한하거나 정지할 수 있습니다:
          </p>
          <ul className="list-disc space-y-2 pl-4 text-[15px] leading-relaxed text-navy-700">
            <li>시스템 점검, 보수, 교체가 필요한 경우</li>
            <li>천재지변, 비상사태 등 불가항력의 경우</li>
            <li>회원이 본 약관을 위반한 경우</li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionHeader title="제7조 (이용 해지)" />
        <Card className="space-y-3 p-5">
          <p className="text-[15px] leading-relaxed text-navy-700">
            회원은 언제든지 서비스 이용 해지를 요청할 수 있으며, 연합회는 본인
            확인 후 처리합니다. 다음의 경우 연합회가 직권으로 회원 자격을 해지할
            수 있습니다:
          </p>
          <ul className="list-disc space-y-2 pl-4 text-[15px] leading-relaxed text-navy-700">
            <li>가입 시 허위 정보를 기재한 경우</li>
            <li>다른 회원의 서비스 이용을 방해한 경우</li>
            <li>법령 또는 본 약관을 위반한 경우</li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionHeader title="제8조 (면책)" />
        <Card className="space-y-3 p-5">
          <ul className="list-disc space-y-2 pl-4 text-[15px] leading-relaxed text-navy-700">
            <li>
              연합회는 회원 간 거래 또는 연결에서 발생하는 분쟁에 대해 직접적인
              책임을 지지 않습니다.
            </li>
            <li>
              서비스를 통해 이루어진 비즈니스 연결의 결과에 대해 연합회는 보증하지
              않습니다.
            </li>
            <li>
              천재지변 또는 이에 준하는 불가항력으로 인한 서비스 중단에 대해
              책임을 지지 않습니다.
            </li>
          </ul>
        </Card>
      </section>

      <Card className="p-5 text-center text-sm text-navy-400">
        <p>시행일: 2025년 1월 1일</p>
        <p className="mt-1">ROTC 비즈니스연합회</p>
      </Card>
    </div>
  )
}
