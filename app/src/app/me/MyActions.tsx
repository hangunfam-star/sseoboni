"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// param: id 상품 id, status 현재 상태. return: 상태에 맞는 숨기기·판매완료·다시 올리기 버튼
export function ListingStatusActions({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function change(next: string) {
    if (pending) return;
    if (next === "SOLD" && !confirm("판매완료로 바꾸면 목록에서 내려가요. 계속할까요?")) return;
    if (next === "REMOVED" && !confirm("이 상품을 삭제할까요? 목록·검색·내 상품에서 사라지고 되돌릴 수 없어요.")) return;
    setPending(true);
    const res = await fetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setPending(false);
    if (!res.ok) {
      alert("상태를 바꾸지 못했어요. 다시 시도해 주세요.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="my-listing__actions">
      <Link className="my-listing__edit" href={`/listings/${id}/edit`}>수정</Link>
      {status === "RESERVED" && <Link className="my-listing__reserved" href="/orders?tab=seller">거래 중 · 거래 보기</Link>}
      {status === "ACTIVE" && <button type="button" disabled={pending} onClick={() => change("HIDDEN")}>숨기기</button>}
      {status === "ACTIVE" && <button type="button" disabled={pending} onClick={() => change("SOLD")}>판매완료</button>}
      {(status === "HIDDEN" || status === "SOLD") && <button type="button" disabled={pending} onClick={() => change("ACTIVE")}>다시 올리기</button>}
      {status !== "RESERVED" && <button type="button" className="my-listing__delete" disabled={pending} onClick={() => change("REMOVED")} aria-label="상품 삭제">삭제</button>}
    </div>
  );
}

// param: kakaoLinked 카카오 연결 여부(연결돼 있으면 다시 들어올 수 있다고 안내)
export function LogoutButton({ kakaoLinked = false }: { kakaoLinked?: boolean }) {
  const router = useRouter();
  async function logout() {
    if (!confirm(kakaoLinked ? "로그아웃할까요? 카카오로 시작하면 지금 계정에 다시 들어올 수 있어요." : "로그아웃하면 이 기기에서 지금 계정으로 다시 들어올 수 없어요. 계속할까요?")) return;
    await fetch("/api/session", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }
  return <button type="button" className="text-button" onClick={logout}>로그아웃</button>;
}
