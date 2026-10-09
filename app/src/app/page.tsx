import Link from "next/link";
import { Icon } from "@/components/Icon";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { listings, productModels } from "@/db/schema";
import { HomeStory } from "@/components/HomeStory";
import { TryFlow } from "@/components/TryFlow";
import { ProductCard, ProductRow } from "@/components/ProductCard";
import { listCards, modelDemand, PAGE_SIZE } from "@/lib/queries";
import { demandLabel } from "@/ui/presentation";

// 홈 — 피드(검색어 없음) / 검색 결과(검색어 있음). 서버 컴포넌트에서 직접 조회.
export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string; c?: string; b?: string; s?: string; n?: string; t?: string }> }) {
  const { q: rawQ, c, b, s, n, t } = await searchParams;
  const q = rawQ?.trim() || undefined;
  const sort = s === "popular" ? "popular" : "new";
  // 브랜드 칩은 판매 중 상품이 있는 모델의 브랜드만(찾는 상품 직접 입력으로 생긴 빈 브랜드 제외)
  const brands = (await db.selectDistinct({ brand: productModels.brand }).from(productModels)
    .innerJoin(listings, and(eq(listings.modelId, productModels.id), eq(listings.status, "ACTIVE")))
    .where(eq(productModels.active, true)).orderBy(asc(productModels.brand))).map((r) => r.brand);
  const brand = b && brands.includes(b) ? b : undefined;
  // 목록 나누기: n쪽까지 보여 준다(한 쪽 20개). 하나 더 가져와 다음 쪽이 있는지 안다. 50쪽(1,000개)이 한도.
  // 홈은 써보니 상품(써보기 허용, 쪽 수 t)과 일반 중고(쪽 수 n)를 나눠 써보니 상품을 위에 보여 준다. 검색 결과는 함께 보여 준다.
  const pageOf = (v?: string) => Math.min(Math.max(Number.parseInt(v ?? "1", 10) || 1, 1), 50);
  const pages = pageOf(n);
  const trialPages = pageOf(t);
  // param: trial 써보기 허용 여부(없으면 전체), pg 보여 줄 쪽 수. return: 카드 목록과 다음 쪽 여부
  async function section(trial: boolean | undefined, pg: number) {
    const fetched = await listCards({ q, categoryId: c, brand, sort, trial, limit: pg * PAGE_SIZE + 1 });
    return { rows: fetched.slice(0, pg * PAGE_SIZE), hasMore: fetched.length > pg * PAGE_SIZE };
  }
  // param: key 늘릴 쪽 수 이름(n 일반·검색, t 써보니), pg 지금 쪽 수, anchor 돌아올 위치. return: 더 보기 링크
  const moreLink = (hasMore: boolean, key: "n" | "t", pg: number, anchor: string) => {
    if (!hasMore) return null;
    if (pg >= 50) return <p className="field-hint">상품이 많아요. 검색어나 브랜드로 좁혀 보세요.</p>;
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (c) p.set("c", c);
    if (brand) p.set("b", brand);
    if (sort === "popular") p.set("s", "popular");
    const other = key === "n" ? trialPages : pages;
    if (other > 1) p.set(key === "n" ? "t" : "n", String(other));
    p.set(key, String(pg + 1));
    return <Link className="more-link" href={`/?${p.toString()}#${anchor}`} scroll={false}>더 보기</Link>;
  };
  const href = (next: { b?: string; s?: string }) => {
    const p = new URLSearchParams();
    if (next.b) p.set("b", next.b);
    if (next.s === "popular") p.set("s", "popular");
    const qs = p.toString();
    return qs ? `/?${qs}` : "/";
  };

  if (q) {
    const { rows, hasMore } = await section(undefined, pages);
    const more = moreLink(hasMore, "n", pages, "search-results");
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
        <p className="result-count" id="search-results">판매 중 <b>{rows.length}{hasMore ? "+" : ""}</b>개</p>
        {rows.length === 0 ? (
          <div className="empty-card">
            <strong>‘{q}’로 올라온 상품이 아직 없어요.</strong>
            <Link href="/demand">찾는 상품으로 남기기</Link>
          </div>
        ) : (
          <div className="product-list">{rows.map((r) => <ProductRow key={r.id} {...r} />)}</div>
        )}
        {more}
      </div>
    );
  }

  const trial = await section(true, trialPages);
  const used = await section(false, pages);
  return (
    <div className="page home-page">
      <header className="home-header">
        <Link className="wordmark" href="/">써보니<span>.</span></Link>
      </header>
      <HomeStory />
      <section className="try-hero" aria-labelledby="try-hero-title">
        <span className="try-hero__tag">베타테스터 미션</span>
        <h2 id="try-hero-title">마음에 드는 상품에서<br /><em>‘써보고 싶어요’</em>를 눌러 주세요</h2>
        <TryFlow label="써보기 흐름 (준비 중)" />
        <p>써보기는 아직 준비 중이에요. 모인 의견으로 어떤 상품부터 써보기를 열지 정해요. 결제와 배송은 일어나지 않아요.</p>
        <Link className="try-hero__link" href="/feedback">망설여진다면 이유를 알려 주세요 →</Link>
      </section>
      <form className="search-bar" action="/" method="get">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <label className="sr-only" htmlFor="home-search">상품 검색</label>
        <input id="home-search" name="q" placeholder="모델명으로 찾아보세요 (예: 맥북 에어)" />
      </form>
      <section className="brand-section" aria-labelledby="brand-title">
        <h2 className="section-title" id="brand-title"><Icon name="tag" />브랜드로 찾기</h2>
        <nav className="brand-row" aria-label="브랜드">
          {brands.map((name) => (
            <Link key={name} className="brand-tile" href={href({ b: brand === name ? undefined : name, s: sort })} aria-current={brand === name ? "true" : undefined}>
              <span className="brand-tile__mark" aria-hidden="true">{Array.from(name)[0]}</span>
              <span>{name}</span>
            </Link>
          ))}
        </nav>
      </section>
      <div className="feed-tabs" role="tablist" aria-label="정렬">
        <Link role="tab" aria-selected={sort === "new"} className="feed-tab" href={href({ b: brand, s: "new" })}>최신순</Link>
        <Link role="tab" aria-selected={sort === "popular"} className="feed-tab" href={href({ b: brand, s: "popular" })}>찜 많은 순</Link>
      </div>
      <section className="product-section product-section--try" id="try-items" aria-labelledby="try-items-title">
        <div className="section-head">
          <h2 className="section-title" id="try-items-title"><span className="try-badge try-badge--inline">써보기</span> 써보고 사는 상품</h2>
          <small>판매자가 써보기를 허락한 상품이에요. 써보고 사면 체험비 0원.</small>
        </div>
        {trial.rows.length === 0 ? (
          <div className="empty-card">
            <strong>{brand ? `${brand} 써보기 상품이 아직 없어요.` : "아직 써보기를 허락한 상품이 없어요."}</strong>
            <Link href="/listings/new">상품 올리고 써보기 허락하기</Link>
          </div>
        ) : (
          <div className="product-grid">{trial.rows.map((row) => <ProductCard key={row.id} {...row} />)}</div>
        )}
        {moreLink(trial.hasMore, "t", trialPages, "try-items")}
      </section>
      <section className="product-section" id="used-items" aria-labelledby="used-items-title">
        <div className="section-head">
          <h2 className="section-title" id="used-items-title"><Icon name="box" />일반 중고</h2>
          <small>바로 사는 상품이에요. 써보고 싶으면 판매자에게 제안할 수 있어요.</small>
        </div>
        {used.rows.length === 0 ? (
          <div className="empty-card">
            <strong>{brand ? `${brand} 일반 중고 상품이 아직 없어요.` : "아직 등록된 일반 중고 상품이 없어요."}</strong>
            <Link href="/listings/new">상품 올리기</Link>
          </div>
        ) : (
          <div className="product-grid">{used.rows.map((row) => <ProductCard key={row.id} {...row} />)}</div>
        )}
        {moreLink(used.hasMore, "n", pages, "used-items")}
      </section>
      <Link className="demand-banner" href="/demand">
        <strong>찾는 물건이 없나요?</strong>
        <small>원하는 모델을 남기면 판매자가 등록할 때 볼 수 있어요</small>
        <span>찾는 상품 남기기</span>
      </Link>
    </div>
  );
}
