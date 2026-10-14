/* eslint-disable @typescript-eslint/no-require-imports -- Node 일회성 스크립트(CommonJS) */
// 시험용 상품 10개를 판매자 계정으로 올린다. 사용자 요청(2026-10-15)으로 만든 일회성 도구.
// 사용: node scripts/seed-test-listings.cjs <판매자 userId> [--db 경로] [--dry]
// - 제목은 모두 "[시험용]"으로 시작한다 → 신청·제안·의향 버튼이 막힌다(src/ui/test-listing.ts).
// - 사진·글은 다른 사람 것을 쓰지 않는다(사진 없음 → 그림 썸네일). 가격은 번개장터 2026-10-15 시세 가운데값.
// - 시장검증 기록(이벤트)은 남기지 않는다(실제 데이터와 섞지 않음). 같은 제목이 이미 있으면 건너뛴다.
const path = require("node:path");
const crypto = require("node:crypto");
const Database = require("better-sqlite3");

const sellerId = process.argv[2];
const dbPath = process.argv.includes("--db") ? process.argv[process.argv.indexOf("--db") + 1] : path.join(__dirname, "..", "dev.db");
const dry = process.argv.includes("--dry");
if (!sellerId) { console.error("사용: node scripts/seed-test-listings.cjs <userId> [--db 경로] [--dry]"); process.exit(1); }

// [브랜드, 모델명(없으면 새로 만듦), 종류, 제목, 가격, 구성품]
const ITEMS = [
  ["Apple", "MacBook Air M2 13인치", "노트북", "맥북 에어 M2 13인치 8GB 256GB", 999000, ["본체", "충전기"]],
  ["LG", "그램 16 (LG gram 16)", "노트북", "LG 그램 16 16GB 512GB", 860000, ["본체", "충전기"]],
  ["Samsung", "갤럭시북3 프로 (Galaxy Book3 Pro)", "노트북", "갤럭시북3 프로 14인치", 1000000, ["본체", "충전기"]],
  ["Apple", "아이패드 에어 5세대", "태블릿", "아이패드 에어 5세대 64GB 와이파이", 500000, ["본체", "충전 케이블"]],
  ["Samsung", "갤럭시탭 S9", "태블릿", "갤럭시탭 S9 128GB S펜 포함", 710000, ["본체", "S펜"]],
  ["Apple", "에어팟 맥스", "오디오", "에어팟 맥스 스페이스 그레이", 300000, ["본체", "스마트 케이스"]],
  ["Sony", "WH-1000XM5", "오디오", "소니 WH-1000XM5 노이즈캔슬링 헤드폰", 213000, ["본체", "케이스", "케이블"]],
  ["Dyson", "에어랩", "생활가전", "다이슨 에어랩 멀티 스타일러", 370000, ["본체", "노즐 세트"]],
  ["Nintendo", "스위치 OLED", "기타", "닌텐도 스위치 OLED 화이트", 256000, ["본체", "조이콘", "독"]],
  ["Apple", "애플워치 시리즈 9", "기타", "애플워치 시리즈 9 45mm GPS", 250000, ["본체", "충전기", "밴드"]],
];
const PREFIX = "[시험용] ";
const DESC = "시험용 상품이에요. 실제로 판매하지 않으니 신청·입금하지 마세요.\n화면 시험을 위해 운영자가 올렸어요. 가격은 번개장터 2026-10-15 시세 가운데값을 참고했어요.";
const round = (n) => Math.max(1000, Math.round(n / 1000) * 1000);

const db = new Database(dbPath);
const seller = db.prepare("select id, nickname from users where id = ?").get(sellerId);
if (!seller) { console.error("판매자 계정을 찾을 수 없어요:", sellerId); process.exit(1); }
const cat = (name) => db.prepare("select id from categories where name = ?").get(name)?.id ?? db.prepare("select id from categories where name = '기타'").get()?.id;

let made = 0, skipped = 0;
const run = db.transaction(() => {
  for (const [brand, modelName, catName, title, price, comps] of ITEMS) {
    const full = PREFIX + title;
    if (db.prepare("select 1 from listings where seller_id = ? and title = ? and status != 'REMOVED'").get(sellerId, full)) { skipped++; continue; }
    let model = db.prepare("select id from product_models where lower(brand) = lower(?) and lower(model_name) = lower(?)").get(brand, modelName);
    if (!model) {
      model = { id: crypto.randomUUID() };
      db.prepare("insert into product_models (id, brand, model_name, category_id, active) values (?, ?, ?, ?, 1)").run(model.id, brand, modelName, cat(catName));
    }
    const id = crypto.randomUUID();
    db.prepare("insert into listings (id, seller_id, model_id, title, price, condition_grade, description, direct_sale_enabled, trial_enabled, status) values (?, ?, ?, ?, ?, 'A', ?, 1, 0, 'ACTIVE')")
      .run(id, sellerId, model.id, full, price, DESC);
    for (const name of comps) db.prepare("insert into listing_components (id, listing_id, name, required_on_return) values (?, ?, ?, 0)").run(crypto.randomUUID(), id, name);
    const tiers = [{ hours: 24, fee: round(price * 0.01) }, { hours: 72, fee: round(price * 0.025) }];
    db.prepare("insert into listing_trial_terms (listing_id, hours, daily_fee, tier_fees, purchase_credit_pct, shipping_one_way, condition_note) values (?, ?, ?, ?, 100, 4000, null)")
      .run(id, JSON.stringify(tiers.map((t) => t.hours)), tiers[0].fee, JSON.stringify(tiers));
    made++;
    console.log(`${dry ? "(시험) " : ""}올림: ${full} · ${price.toLocaleString("ko-KR")}원 · 써보기 24시간 ${tiers[0].fee.toLocaleString("ko-KR")}원 / 72시간 ${tiers[1].fee.toLocaleString("ko-KR")}원`);
  }
  if (dry) throw new Error("__dry__");
});
try { run(); } catch (e) { if (e.message !== "__dry__") throw e; }
console.log(`판매자 ${seller.nickname ?? sellerId}: 새로 ${made}개, 이미 있어 건너뜀 ${skipped}개${dry ? " (시험 실행이라 저장 안 함)" : ""}`);
