// param: name 표시 이름, src 프로필 사진 주소(없으면 첫 글자), large 큰 크기. return: 동그란 프로필 표시
export function Avatar({ name, src, large }: { name: string; src: string | null; large?: boolean }) {
  return (
    <span className={`seller-avatar${large ? " seller-avatar--lg" : ""}${src ? " seller-avatar--photo" : ""}`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- 카카오 사진 서버 주소를 그대로 쓴다 */}
      {src ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" /> : Array.from(name)[0]}
    </span>
  );
}
