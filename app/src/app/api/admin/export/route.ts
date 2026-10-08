import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { eventRows } from "@/lib/admin-metrics";

// param: v 칸 값. return: CSV 한 칸(쉼표·따옴표·줄바꿈을 감싼다, 수식 실행 방지로 공백·제어문자 뒤 =+-@ 또는 제어문자로 시작하면 ' 를 붙인다)
function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // 앞쪽 공백·제어문자(탭·줄바꿈 등) 뒤에 =+-@가 오거나, 제어문자로 시작하면 글자로 강제한다.
  if (/^[\s\x00-\x1f]*[=+\-@]/.test(s) || /^[\x00-\x1f]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/admin/export — 운영자만, 시장검증 이벤트 전체 CSV(엑셀용 BOM 포함)
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "운영자만 받을 수 있어요." }, { status: 401 });
  const rows = eventRows();
  const cols = ["created_at", "event_type", "listing_id", "listing_title", "category", "brand", "model_name", "user_id", "nickname", "metadata"];
  const csv = "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sseoboni-events-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
