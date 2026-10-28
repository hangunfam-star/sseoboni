// 클라이언트·서버 공용: 저장된 사진 파일 이름 → 주소. ?v=2: 예전 1년 캐시 사본을 쓰지 않게(탈퇴 2단계 6절)
export function photoUrl(name: string): string {
  return `/api/photos/${name}?v=2`;
}
