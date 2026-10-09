import { SafePhoto } from "@/components/SafePhoto";
import { ProductIllustration } from "@/components/ProductIllustration";
import { photoUrl } from "@/lib/photo-url";
import type { IllustrationKind } from "@/ui/presentation";

// param: photo 사진 파일 이름(없으면 null), seed 일러스트 배경 고정값, kind 일러스트 종류, alt 사진 설명
// return: 목록 앞쪽 둥근 모서리 썸네일(사진이 없으면 모델 일러스트)
export function ListThumb({ photo, seed, kind, alt }: { photo: string | null; seed: string; kind: IllustrationKind; alt: string }) {
  return photo
    ? <span className="list-thumb list-thumb--img"><SafePhoto className="product-photo" src={photoUrl(photo)} alt={alt} sizes="72px" fallback={<ProductIllustration seed={seed} kind={kind} size={44} />} /></span>
    : <ProductIllustration className="list-thumb" seed={seed} kind={kind} size={44} />;
}
