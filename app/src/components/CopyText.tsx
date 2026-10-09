"use client";
import { useState } from "react";

// param: text 복사할 값, label 버튼 이름. return: 누르면 복사하고 "복사했어요"를 잠깐 보여 주는 버튼
export function CopyText({ text, label = "복사" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="copy-button" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* 복사 권한이 없으면 사용자가 직접 선택 */ }
    }}>{done ? "복사했어요" : label}</button>
  );
}
