// 클라이언트·서버 공용: 저장된 사진 파일 이름 → 주소
export function photoUrl(name: string): string {
  return `/api/photos/${name}`;
}
