import { Link } from 'react-router-dom'
import { ChevronLeft, Shield } from 'lucide-react'
import { Card, PageHeader, SectionHeader } from '../components/ui'

export function PrivacyPage() {
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
        title="개인정보처리방침"
        subtitle="개인정보보호법에 따른 개인정보 처리방침"
        icon={<Shield className="size-5" />}
      />

      <section>
        <SectionHeader title="제1조 (개인정보 처리 목적)" />
        <Card className="space-y-3 p-5">
          <p className="text-[15px] leading-relaxed text-navy-700">
            ROTC 비즈니스연합회(이하 "연합회")는 알비연 링크 서비스 운영을 위해
            다음의 목적으로 개인정보를 처리합니다:
          </p>
          <ul className="list-disc space-y-2 pl-4 text-[15px] leading-relaxed text-navy-700">
            <li>회원 가입 및 본인 확인</li>
            <li>회원 간 비즈니스 연결 및 매칭</li>
            <li>도움요청/사업소개 서비스 제공</li>
            <li>행사/후원 정보 안내</li>
            <li>서비스 이용 통계 및 개선</li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionHeader title="제2조 (수집하는 개인정보 항목)" />
        <Card className="space-y-3 p-5">
          <p className="text-[15px] leading-relaxed text-navy-700">
            연합회는 서비스 제공을 위해 다음의 개인정보를 수집합니다:
          </p>
          <ul className="list-disc space-y-2 pl-4 text-[15px] leading-relaxed text-navy-700">
            <li>
              <strong>필수항목:</strong> 이름, 전화번호, ROTC 기수
            </li>
            <li>
              <strong>선택항목:</strong> 회사명, 직책, 업종, 출신학교, 지역,
              사업소개, 줄 수 있는 도움, 프로필 사진
            </li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionHeader title="제3조 (개인정보의 보유 및 이용기간)" />
        <Card className="space-y-3 p-5">
          <p className="text-[15px] leading-relaxed text-navy-700">
            회원의 개인정보는 서비스 이용 기간 동안 보유하며, 회원 탈퇴 시 지체
            없이 파기합니다. 다만, 관련 법령에 따라 보존이 필요한 경우 해당
            기간까지 보관합니다:
          </p>
          <ul className="list-disc space-y-2 pl-4 text-[15px] leading-relaxed text-navy-700">
            <li>서비스 이용 기록: 3년 (전자상거래법)</li>
            <li>접속 로그: 3개월 (통신비밀보호법)</li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionHeader title="제4조 (개인정보의 제3자 제공)" />
        <Card className="space-y-3 p-5">
          <p className="text-[15px] leading-relaxed text-navy-700">
            연합회는 회원의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.
            다만, 다음의 경우는 예외로 합니다:
          </p>
          <ul className="list-disc space-y-2 pl-4 text-[15px] leading-relaxed text-navy-700">
            <li>회원이 사전에 동의한 경우</li>
            <li>법령에 의해 요구되는 경우</li>
            <li>
              서비스 내에서 회원 간 연결을 위해 프로필 정보가 다른 회원에게
              노출되는 경우 (회원 가입 시 동의)
            </li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionHeader title="제5조 (정보주체의 권리)" />
        <Card className="space-y-3 p-5">
          <p className="text-[15px] leading-relaxed text-navy-700">
            회원은 언제든지 다음의 권리를 행사할 수 있습니다:
          </p>
          <ul className="list-disc space-y-2 pl-4 text-[15px] leading-relaxed text-navy-700">
            <li>개인정보 열람 요구</li>
            <li>오류 등이 있을 경우 정정 요구</li>
            <li>삭제 요구</li>
            <li>처리 정지 요구</li>
          </ul>
          <p className="text-[15px] leading-relaxed text-navy-700">
            위 권리 행사는 서비스 내 프로필 수정 기능을 통해 직접 처리하거나,
            운영진에게 연락하여 요청할 수 있습니다.
          </p>
        </Card>
      </section>

      <section>
        <SectionHeader title="제6조 (개인정보의 안전성 확보 조치)" />
        <Card className="space-y-3 p-5">
          <p className="text-[15px] leading-relaxed text-navy-700">
            연합회는 개인정보의 안전성 확보를 위해 다음 조치를 취하고 있습니다:
          </p>
          <ul className="list-disc space-y-2 pl-4 text-[15px] leading-relaxed text-navy-700">
            <li>데이터 전송 시 암호화(HTTPS/TLS)</li>
            <li>접근 권한 관리 및 제한</li>
            <li>개인정보 취급 직원 최소화</li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionHeader title="제7조 (개인정보 보호책임자)" />
        <Card className="space-y-3 p-5">
          <p className="text-[15px] leading-relaxed text-navy-700">
            개인정보 처리에 관한 문의, 불만처리, 피해구제 등은 아래로 연락해
            주시기 바랍니다:
          </p>
          <div className="mt-2 rounded-lg bg-navy-50 p-3 text-sm text-navy-700">
            <p>
              <strong>개인정보 보호책임자:</strong> ROTC 비즈니스연합회 운영진
            </p>
            <p className="mt-1">
              <strong>문의:</strong> 서비스 내 문의 기능 이용
            </p>
          </div>
        </Card>
      </section>

      <section>
        <SectionHeader title="제8조 (개인정보 처리방침 변경)" />
        <Card className="space-y-3 p-5">
          <p className="text-[15px] leading-relaxed text-navy-700">
            본 방침은 법령, 정책 또는 서비스 변경에 따라 수정될 수 있으며, 변경 시
            서비스 내 공지를 통해 안내합니다.
          </p>
        </Card>
      </section>

      <Card className="p-5 text-center text-sm text-navy-400">
        <p>시행일: 2025년 1월 1일</p>
        <p className="mt-1">ROTC 비즈니스연합회</p>
      </Card>
    </div>
  )
}
