import { SafePhoto } from "@/components/SafePhoto";
import Link from "next/link";
import { ProductIllustration } from "@/components/ProductIllustration";
import { photoUrl } from "@/lib/photo-url";
import type { CardRow } from "@/lib/queries";
import { conditionLabel, formatWon, illustrationKind, relativeTime, tryBadgeLabel, tryWantLabel } from "@/ui/presentation";

// 홈·찜 피드용 사진 중심 카드
export function ProductCard(props: CardRow) {
  const meta = [relativeTime(props.createdAt), props.wishCount > 0 ? `찜 ${props.wishCount}` : null].filter(Boolean).join(" · ");
  return (
    <Link className="product-card" href={`/listings/${props.id}`}>
      <div className="product-card__photo">
        {props.photo
          ? <SafePhoto className="product-photo" src={photoUrl(props.photo)} alt={props.title} sizes="(max-width: 480px) 45vw, 220px" fallback={<ProductIllustration seed={props.id} kind={illustrationKind(props.categoryName, props.modelName)} size={110} />} />
          : <ProductIllustration seed={props.id} kind={illustrationKind(props.categoryName, props.modelName)} size={110} />}
        {tryBadgeLabel(props.tryOk) && <span className="try-badge">{tryBadgeLabel(props.tryOk)}</span>}
      </div>
      <div className="product-card__body">
        <small className="product-card__model">{[props.brand, props.modelName].filter(Boolean).join(" ")}</small>
        <h3>{props.title}</h3>
        <strong>{formatWon(props.price)}</strong>
        {tryWantLabel(props.tryWanters) && <small className="try-count">{tryWantLabel(props.tryWanters)}</small>}
        {meta && <small>{meta}</small>}
      </div>
    </Link>
  );
}

// 검색 결과용 목록형 행
export function ProductRow(props: CardRow) {
  return (
    <Link className="product-row" href={`/listings/${props.id}`}>
      {props.photo
        ? <span className="product-row__photo product-row__photo--img"><SafePhoto className="product-photo" src={photoUrl(props.photo)} alt={props.title} sizes="112px" fallback={<ProductIllustration seed={props.id} kind={illustrationKind(props.categoryName, props.modelName)} size={70} />} /></span>
        : <ProductIllustration className="product-row__photo" seed={props.id} kind={illustrationKind(props.categoryName, props.modelName)} size={70} />}
      <div className="product-row__body">
        {tryBadgeLabel(props.tryOk) && <span className="try-badge try-badge--inline">{tryBadgeLabel(props.tryOk)}</span>}
        <h3>{props.title}</h3>
        <small>{[props.brand, props.modelName].filter(Boolean).join(" ")} · {conditionLabel(props.conditionGrade)} · {relativeTime(props.createdAt)}</small>
        <strong>{formatWon(props.price)}</strong>
        {tryWantLabel(props.tryWanters) && <small className="try-count">{tryWantLabel(props.tryWanters)}</small>}
        {props.wishCount > 0 && <small className="product-row__wish">찜 {props.wishCount}</small>}
      </div>
    </Link>
  );
}
