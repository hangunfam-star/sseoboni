import Link from "next/link";
import { modelDemand } from "@/lib/queries";
import { demandLabel } from "@/ui/presentation";
import { DemandForm } from "./DemandForm";

const CARD_TONES = ["demand-card--coral", "demand-card--yellow", "demand-card--navy"];

// 찾는 상품 — 모델별 실제 수요(중복 제거) + 찾는 상품 남기기
export default async function DemandPage({ searchParams }: { searchParams: Promise<{ model?: string }> }) {
  const { model } = await searchParams;
  const demand = await modelDemand();

  return (
    <div className="page demand-page">
      <h1 className="page-title">찾는 상품</h1>
      <p className="page-lead">사고 싶거나 써보고 싶은 모델을 남겨 주세요. 판매자가 등록할 때 이 수요를 봐요.</p>
      <DemandForm models={demand.map((d) => ({ id: d.modelId, label: `${d.brand} ${d.modelName}` }))} initialModelId={model ?? ""} />
      <h2 className="section-title">사람들이 찾고 있어요</h2>
      <div className="demand-list">
        {demand.map((d, i) => (
          <Link key={d.modelId} className={`demand-card ${CARD_TONES[i % CARD_TONES.length]}`} href={`/?q=${encodeURIComponent(d.modelName)}`}>
            <small>{d.brand}</small>
            <strong>{d.modelName}</strong>
            <span>{demandLabel(d.seekers) ?? "아직 찾는 사람이 없어요"} · 판매 중 {d.onSale}개</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
