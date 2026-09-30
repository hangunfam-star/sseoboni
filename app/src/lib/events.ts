// 시장검증 이벤트 기록 도우미
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { marketValidationEvents } from "@/db/schema";

const VIEW_DEDUP_MINUTES = 30;

// param: listingId, modelId, userId(비로그인 null). return: 없음.
// 로그인 사용자가 같은 상품을 30분 안에 다시 보면 새로 기록하지 않는다(새로고침 부풀림 방지).
export async function recordListingView(listingId: string, modelId: string, userId: string | null): Promise<void> {
  if (userId) {
    const recent = await db.query.marketValidationEvents.findFirst({
      where: and(
        eq(marketValidationEvents.userId, userId),
        eq(marketValidationEvents.listingId, listingId),
        eq(marketValidationEvents.eventType, "VIEW_LISTING"),
        gt(marketValidationEvents.createdAt, sql`datetime('now', ${`-${VIEW_DEDUP_MINUTES} minutes`})`),
      ),
    });
    if (recent) return;
  }
  await db.insert(marketValidationEvents).values({ eventType: "VIEW_LISTING", listingId, modelId, userId });
}
