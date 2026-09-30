import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { categories } from "@/db/schema";
import { ProductCard, ProductRow } from "@/components/ProductCard";
import { listCards, modelDemand } from "@/lib/queries";
import { demandLabel } from "@/ui/presentation";

// 홈 — 피드(검색어 없음) / 검색 결과(검색어 있음). 서버 컴포넌트에서 직접 조회.
export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string; c?: string }> }) {
  const { q: rawQ, c } = await searchParams;
  const q = rawQ?.trim() || undefined;
  const cats = await db.select().from(categories).orderBy(asc(categories.name));
  const rows = await listCards({ q, categoryId: c });

  if (q) {
    const names = new Set(rows.map((r) => r.modelName));
    const ql = q.toLowerCase();
    const demand = (await modelDemand()).filter((m) => `${m.brand} ${m.modelName}`.toLowerCase().includes(ql) || names.has(m.modelName));
    const top = demand[0];
    const topLabel = top ? demandLabel(top.seekers) : null;
    return (
      <div className="page search-page">
        <form className="search-bar search-bar--active" action="/" method="get">
          <Link className="icon-button" href="/" aria-label="뒤로"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></Link>
          <label className="sr-only" htmlFor="search-q">검색어</label>
          <input id="search-q" name="q" defaultValue={q} placeholder="모델명으로 찾아보세요" />
          <button type="submit">검색</button>
        </form>
        {top && (
          <div className="demand-strip">
            <div>
              <small>{top.brand} {top.modelName}</small>
              <strong>{topLabel ?? "아직 찾는 사람이 없어요"}</strong>
              <small>판매 중 {top.onSale}개</small>
            </div>
            <Link href={`/demand?model=${top.modelId}`}>나도 기다리기</Link>
          </div>
        )}
        <p className="result-count">판매 중 <b>{rows.length}</b>개</p>
        {rows.length === 0 ? (
          <div className="empty-card">
            <strong>‘{q}’로 올라온 상품이 아직 없어요.</strong>
            <Link href="/demand">찾는 상품으로 남기기</Link>
          </div>
        ) : (
          <div className="product-list">{rows.map((r) => <ProductRow key={r.id} {...r} />)}</div>
        )}
      </div>
    );
  }

  return (
    <div className="page home-page">
      <header className="home-header">
        <Link className="wordmark" href="/">써보니<span>.</span></Link>
      </header>
      <h1 className="home-title">오늘은 어떤 중고를<br />써볼까요?</h1>
      <form className="search-bar" action="/" method="get">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <label className="sr-only" htmlFor="home-search">상품 검색</label>
        <input id="home-search" name="q" placeholder="모델명으로 찾아보세요 (예: 맥북 에어)" />
      </form>
      <nav className="chip-row" aria-label="카테고리">
        <Link className="chip" href="/" aria-current={!c ? "true" : undefined}>전체</Link>
        {cats.map((cat) => (
          <Link key={cat.id} className="chip" href={`/?c=${cat.id}`} aria-current={c === cat.id ? "true" : undefined}>{cat.name}</Link>
        ))}
      </nav>
      <section className="product-section">
        <h2 className="section-title">방금 올라온 중고</h2>
        {rows.length === 0 ? (
          <div className="empty-card">
            <strong>아직 등록된 상품이 없어요.</strong>
            <Link href="/listings/new">첫 상품 올리기</Link>
          </div>
        ) : (
          <div className="product-grid">{rows.map((row) => <ProductCard key={row.id} {...row} />)}</div>
        )}
      </section>
      <Link className="demand-banner" href="/demand">
        <strong>찾는 물건이 없나요?</strong>
        <small>찾는 상품을 남기면 사람들이 찾고 있어요 목록에 모여요</small>
        <span>찾는 상품 남기기</span>
      </Link>
    </div>
  );
}
