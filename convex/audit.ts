import type { MutationCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'

// 운영진 행위 감사 액션 — 화이트리스트. 새 액션은 여기에 추가.
export type AuditAction =
  | 'member.approve' // 승인 대기 회원 승인
  | 'member.activate' // 상태를 active로 전환
  | 'member.setPending' // 상태를 pending으로 전환
  | 'member.suspend' // 계정 정지
  | 'admin.grant' // 운영진 권한 부여
  | 'admin.revoke' // 운영진 권한 회수

// 운영진 행위를 불변 감사 로그로 기록. 행위자/대상의 이름은 호출 시점 스냅샷으로 보존
// (대상이 이후 개명·삭제돼도 당시 맥락을 유지). 기록 실패가 본 작업을 막지 않도록
// 호출부는 patch 성공 이후에 호출한다.
export async function recordAudit(
  ctx: MutationCtx,
  actor: Doc<'members'>,
  action: AuditAction,
  target?: Doc<'members'> | null,
  detail?: string,
): Promise<void> {
  await ctx.db.insert('auditLogs', {
    actorId: actor._id,
    actorName: actor.name,
    action,
    targetId: target?._id,
    targetName: target?.name,
    detail,
    createdAt: Date.now(),
  })
}
