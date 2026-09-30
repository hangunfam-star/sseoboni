import Link from "next/link";
import { ProductIllustration } from "@/components/ProductIllustration";
import type { CardRow } from "@/lib/queries";
import { conditionLabel, formatWon, illustrationKind, relativeTime } from "@/ui/presentation";

// 홈·찜 피드용 사진 중심 카드
export function ProductCard(props: CardRow) {
  const meta = [relativeTime(props.createdAt), props.wishCount > 0 ? `찜 ${props.wishCount}` : null].filter(Boolean).join(" · ");
  return (
    <Link className="product-card" href={`/listings/${props.id}`}>
      <div className="product-card__photo">
        <ProductIllustration seed={props.id} kind={illustrationKind(props.categoryName, props.modelName)} size={92} />
        <span className="grade-badge">{conditionLabel(props.conditionGrade)}</span>
      </div>
      <h3>{props.title}</h3>
      <strong>{formatWon(props.price)}</strong>
      {meta && <small>{meta}</small>}
    </Link>
  );
}

// 검색 결과용 목록형 행
export function ProductRow(props: CardRow) {
  return (
    <Link className="product-row" href={`/listings/${props.id}`}>
      <ProductIllustration className="product-row__photo" seed={props.id} kind={illustrationKind(props.categoryName, props.modelName)} size={70} />
      <div className="product-row__body">
        <h3>{props.title}</h3>
        <small>{[props.brand, props.modelName].filter(Boolean).join(" ")} · {conditionLabel(props.conditionGrade)} · {relativeTime(props.createdAt)}</small>
        <strong>{formatWon(props.price)}</strong>
        {props.wishCount > 0 && <small className="product-row__wish">찜 {props.wishCount}</small>}
      </div>
    </Link>
  );
}
