import type { IllustrationKind } from "@/ui/presentation";

const TINTS = ["#ffe3df", "#fff3c4", "#e3e9f8", "#f3f1f0"];

// param: seed 상품 id(배경색을 고정하기 위한 값), kind 일러스트 종류, size 아이콘 폭(px)
// return: 사진이 없을 때 쓰는 모델 일러스트. 실제 사진이 아님을 aria-label로 밝힌다.
export function ProductIllustration({ seed, kind, size = 96, className }: { seed: string; kind: IllustrationKind; size?: number; className?: string }) {
  const tint = TINTS[Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];
  return (
    <div className={`illustration ${className ?? ""}`} style={{ background: tint }} role="img" aria-label="상품 사진 준비 중 (모델 일러스트)">
      <svg width={size} height={size * 0.75} viewBox="0 0 96 72" aria-hidden="true">
        {kind === "laptop" && (<><rect x="14" y="8" width="68" height="44" rx="4" fill="#fff" stroke="#1c1e24" strokeWidth="3" /><path d="M4 58h88l-6 8H10z" fill="#1c1e24" /></>)}
        {kind === "tablet" && (<><rect x="26" y="2" width="44" height="68" rx="8" fill="#1c1e24" /><rect x="31" y="8" width="34" height="54" rx="3" fill="#fff" /></>)}
        {kind === "audio" && (<><path d="M20 46V38a28 28 0 0156 0v8" fill="none" stroke="#1c1e24" strokeWidth="6" strokeLinecap="round" /><rect x="12" y="40" width="17" height="26" rx="8" fill="#1c1e24" /><rect x="67" y="40" width="17" height="26" rx="8" fill="#1c1e24" /></>)}
        {kind === "camera" && (<><path d="M30 14l6-8h24l6 8z" fill="#1c1e24" /><rect x="6" y="14" width="84" height="52" rx="10" fill="#1c1e24" /><circle cx="48" cy="40" r="17" fill="#fff" /><circle cx="48" cy="40" r="9" fill="#1b3a8c" /></>)}
        {kind === "generic" && (<><rect x="18" y="14" width="60" height="48" rx="10" fill="#1c1e24" /><path d="M36 14V8h24v6" fill="none" stroke="#1c1e24" strokeWidth="4" /></>)}
      </svg>
    </div>
  );
}
