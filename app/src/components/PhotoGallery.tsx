"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { photoUrl } from "@/lib/photo-url";

// param: photos 저장된 사진(순서대로), title 대체 텍스트용 상품 제목. return: 옆으로 넘기는 사진 영역과 현재 장 표시
export function PhotoGallery({ photos, title }: { photos: { fileName: string; width: number; height: number }[]; title: string }) {
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  function onScroll() {
    const el = track.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <div className="gallery">
      <div className="gallery__track" ref={track} onScroll={onScroll}>
        {photos.map((p, i) => (
          <Image key={p.fileName} src={photoUrl(p.fileName)} width={p.width} height={p.height} sizes="(max-width: 480px) 100vw, 480px" alt={`${title} 사진 ${i + 1}`} priority={i === 0} />
        ))}
      </div>
      {photos.length > 1 && <span className="gallery__count" aria-live="polite">{index + 1} / {photos.length}</span>}
    </div>
  );
}
