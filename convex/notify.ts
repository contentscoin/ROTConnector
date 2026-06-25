import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

// 인앱 알림 타입 — 화이트리스트. 새 알림 종류는 여기에 추가.
export type NotificationType =
  | 'connection.request' // 교류 신청을 받음
  | 'connection.accepted' // 내가 보낸 신청이 수락됨
  | 'member.approved' // 가입이 승인됨
  | 'request.matched' // 내 도움요청에 도움 제공자가 연결됨(작성자 대상)
  | 'request.connected' // 내 도움요청이 연결 완료됨(작성자 대상)
  | 'match.proposed' // 내가 도움 제공자로 매칭됨(헬퍼 대상)
  | 'match.completed' // 내가 도운 연결이 완료되어 기여 적립됨(헬퍼 대상)

// 수신자에게 인앱 알림 1건 적재. 호출부는 본 작업(insert/patch) 성공 이후에 호출한다.
// 알림 생성 실패가 원작업을 롤백하지 않도록 항상 마지막 단계로 둔다.
export async function createNotification(
  ctx: MutationCtx,
  userId: Id<'members'>,
  n: {
    type: NotificationType
    title: string
    body?: string
    link?: string
    refId?: string
  },
): Promise<void> {
  await ctx.db.insert('notifications', {
    userId,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    refId: n.refId,
    read: false,
    createdAt: Date.now(),
  })
}
