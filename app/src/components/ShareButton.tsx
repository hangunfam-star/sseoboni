"use client";
import { useState } from "react";

// param: listingId 상품 id, title 상품 제목, text 공유 문구
// return: 공유 버튼. 휴대폰은 기본 공유창(카카오톡 포함), 그 밖은 링크 복사
export function ShareButton({ listingId, text }: { listingId: string; title?: string; text: string }) {
  const [notice, setNotice] = useState<string | null>(null);

  function record(method: "SHARE_SHEET" | "COPY_LINK") {
    void fetch(`/api/listings/${listingId}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method }) }).catch(() => undefined);
  }

  function show(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2600);
  }

  async function share() {
    const url = `${location.origin}/listings/${listingId}`;
    if (typeof navigator.share === "function") {
      try {
        // 제목을 따로 넘기면 안드로이드가 "제목 - 문구"로 붙여 상품명이 두 번 나온다 → 문구·주소만 넘긴다
        await navigator.share({ text, url });
        record("SHARE_SHEET");
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // 사용자가 공유창을 닫음
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      record("COPY_LINK");
      show("링크를 복사했어요. 카카오톡 대화창에 붙여 넣어 보내세요.");
    } catch {
      show(`이 주소를 복사해 보내세요: ${url}`);
    }
  }

  return (
    <>
      <button type="button" className="icon-button icon-button--float icon-button--share" onClick={() => void share()} aria-label="공유하기">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v14" /></svg>
      </button>
      {notice && <p className="share-toast" role="status">{notice}</p>}
    </>
  );
}
