/* eslint-disable @typescript-eslint/no-require-imports -- Node 일회성 스크립트(CommonJS) */
// 당근 판매 물품(scrape 결과 items.json + 사진)을 써보니 상품으로 한 번에 올린다. 사용자 요청(2026-10-09)으로 만든 일회성 도구.
// 사용: node scripts/import-daangn.cjs <items.json 폴더> <판매자 userId> [--db 경로] [--dry]
// - 판매 중(InStock)인 물품만 올린다. 예약중·판매완료는 건너뛴다.
// - 같은 당근 글은 두 번 올리지 않는다(시장검증 이벤트 SELLER_LISTING_IMPORTED의 articleId로 확인).
// - 써보기 의향은 판매자가 답한 적이 없으므로 기록하지 않는다(→ 홈의 '일반 중고'). 시장검증 지표(SELLER_LISTING_COMPLETE)도 남기지 않는다.
// - 설명에서 전화번호·문자·직거래 장소·택배 안내 줄은 뺀다(써보니 안에서만 거래).
// - 상태 등급은 당근에 없는 값이라 제목으로 추정한다: 새상품 → S, 1회착 → A, 그 밖 → B(판매자가 수정 화면에서 고칠 수 있음).
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Database = require("better-sqlite3");
const sharp = require("sharp");

const [dir, sellerId] = process.argv.slice(2);
const dbPath = process.argv.includes("--db") ? process.argv[process.argv.indexOf("--db") + 1] : path.join(__dirname, "..", "dev.db");
const dry = process.argv.includes("--dry");
const uploads = path.join(__dirname, "..", "runtime-data", "uploads");
if (!dir || !sellerId) { console.error("사용: node scripts/import-daangn.cjs <폴더> <userId> [--db 경로] [--dry]"); process.exit(1); }

const BRANDS = [
  [/나이키|nike/i, "나이키"], [/아디다스|아이다스|adidas/i, "아디다스"], [/컨버스|척\s*테일러|척테이러|척\s*70|척테일러|올스타/i, "컨버스"],
  [/뉴발란스/, "뉴발란스"], [/라코스테/, "라코스테"], [/팀버랜드/, "팀버랜드"], [/컬럼비아/, "컬럼비아"], [/지프|jeep/i, "지프"],
  [/금강제화|와키앤타키/, "금강제화"], [/블랙야크/, "블랙야크"], [/리바이스/, "리바이스"], [/버커루/, "버커루"], [/뉴에라/, "뉴에라"],
  [/반스/, "반스"], [/아식스|asics|오니츠카/i, "아식스"], [/퀵실버/, "퀵실버"], [/아베크롬비/, "아베크롬비"], [/빈폴/, "빈폴"],
  [/노스페이스/, "노스페이스"], [/언더아머/, "언더아머"], [/살레와/, "살레와"], [/수퍼드라이|슈퍼드라이/, "슈퍼드라이"],
  [/디스커버리/, "디스커버리"], [/푸마/, "푸마"], [/디아도라/, "디아도라"], [/리복/, "리복"], [/탐스/, "탐스"], [/제옥스/, "제옥스"],
  [/테바|teva/i, "테바"], [/락피쉬/, "락피쉬"], [/호킨스/, "호킨스"], [/엄브로/, "엄브로"], [/삼성/, "삼성"], [/다이슨/, "다이슨"],
  [/레이캅/, "레이캅"], [/시디즈/, "시디즈"], [/크록스/, "크록스"], [/베어파우/, "베어파우"], [/캘빈클라인|\bCK\b/, "캘빈클라인"],
  [/스파오/, "스파오"], [/디젤/, "디젤"], [/지스타/, "지스타"], [/엠리미트/, "엠리미트"], [/카카오/, "카카오프렌즈"], [/키친아트/, "키친아트"],
  [/교원/, "교원"], [/퓨어레인/, "퓨어레인"], [/unitek/i, "유니텍"], [/카야이크만/, "카야이크만"], [/베자/, "베자"], [/블루마운틴/, "블루마운틴"],
  [/어더스|earthus/i, "어더스"], [/본깁스/, "본깁스"], [/숀리/, "숀리"], [/카니발/, "기아"], [/스틸리/, "스틸리"], [/반앤웍스/, "반앤웍스"],
  [/한게임/, "한게임"], [/학성/, "학성"], [/soloist/i, "솔로이스트"], [/존 바바토스/, "컨버스"], [/존슨즈/, "존슨즈"],
];
const SHOE = /스니커즈|슈즈|부츠|샌들|슬립온|슬라이드|크록스|컴포트화|캔버스화|운동화|실내화|척\s*테일러|척테이러|척\s*70|올스타|에어맥스|블레이저|코르테즈|와플|킬샷|볼텍스|클라이드|슈퍼스타|캠퍼스|스페지알|라콤베|PTG|멕시코 66|2002R|710|BW 아미|로릭|게임L|추카|ACG|오아시스|트레일|TRAIL|플라이니트|보이저|오리온|3MC|코트 데이즈|스타 플레이어|프리데이|GL6000|크래프트|슬라아드|스티커즈|로마스|워커/i;
const CLOTH = /패딩|자켓|재킷|점퍼|티셔츠|셔츠|맨투맨|후드|후리스|플리스|스웨터|가디건|코트|데님|진\b|스키니진|팬츠|반바지|스커트|원피스|베스트|아노락|바람막이|트랙탑|져지|스웨트|폴로|반팔|긴팔|레시가드|수영복|조거|카고|무스탕|크루|트레이닝|면티|라운드티|파이어버드|앞치마|워싱진|스웻/;
const LIVING = /청소기|선풍기|충전|배터리|스탠드|필터|스피커|삼각대|아령|스쿼트|매트|의자|링고|그리들|캠핑|방향제|거치대|차량/;

// param: name 당근 제목. return: 써보니 상품 종류
function categoryOf(name) {
  if (/스피커/.test(name)) return "오디오";
  if (SHOE.test(name)) return "신발";
  if (CLOTH.test(name)) return "의류";
  if (/청소기|선풍기|충전|배터리|스탠드|필터/.test(name)) return "생활가전";
  return "기타";
}
const brandOf = (name) => (BRANDS.find(([re]) => re.test(name)) ?? [null, "기타"])[1];
// param: name 제목, brand 브랜드. return: 모델명(앞의 관리번호·[새상품] 표시·맨 앞 브랜드명을 뺀 제목, 2~60자)
function modelNameOf(name, brand) {
  let s = name.replace(/^\s*\d+\s*-\s*/, "").replace(/\[(새상품|신상품|1회착)\]|새상품👍?/g, "").replace(/\s+/g, " ").trim();
  if (brand !== "기타" && s.startsWith(brand) && s.slice(brand.length).trim().length >= 2) s = s.slice(brand.length).trim();
  if (s.length < 2) s = name.trim();
  return s.slice(0, 60);
}
const gradeOf = (name) => (/새상품|신상품|새제품/.test(name) ? "S" : /1회착/.test(name) ? "A" : "B");
const DROP = /(01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}|공일공|문자|문의|톡\s*주|채팅|직거래|반택|택배|거래\s*가능|거래는|송내대로|효성프라자|gs\s*\/\s*cu|편의점)/i;
// param: d 당근 설명. return: 연락처·직거래·택배 안내 줄을 뺀 설명
function cleanDescription(d, name) {
  const lines = d.replace(/\r/g, "").split("\n").filter((l) => !DROP.test(l));
  const out = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return (out || name).slice(0, 2000);
}

(async () => {
  const data = JSON.parse(fs.readFileSync(path.join(dir, "items.json"), "utf8"));
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  if (!db.prepare("select 1 from users where id = ?").get(sellerId)) throw new Error("판매자 없음");
  const imported = new Set(db.prepare("select json_extract(metadata,'$.articleId') a from market_validation_events where event_type='SELLER_LISTING_IMPORTED'").all().map((r) => r.a));
  const report = { imported: [], skipped: [], failed: [] };
  for (const it of data.items) {
    const name = it.name.trim();
    if (!/InStock$/.test(it.availability ?? "")) { report.skipped.push({ name, reason: `판매 중 아님(${(it.availability ?? "").split("/").pop()})` }); continue; }
    if (imported.has(it.articleId)) { report.skipped.push({ name, reason: "이미 올림" }); continue; }
    const price = Math.round(Number(it.price));
    if (!Number.isSafeInteger(price) || price < 1000) { report.failed.push({ name, reason: `가격 확인 필요(${it.price})` }); continue; }
    const row = { title: name.slice(0, 60), price, grade: gradeOf(name), category: categoryOf(name), brand: brandOf(name), modelName: modelNameOf(name, brandOf(name)), description: cleanDescription(it.description ?? "", name) };
    if (dry) { report.imported.push({ ...row, photos: it.photos.length }); continue; }
    try {
      // 사진 먼저 다시 인코딩(메타데이터 제거·1600px·webp) — 실패하면 그 사진만 뺀다
      const photos = [];
      for (const f of it.photos) {
        try {
          const { data: buf, info } = await sharp(fs.readFileSync(path.join(dir, "img", f)), { failOn: "error" }).rotate()
            .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
          const fileName = `${crypto.randomBytes(12).toString("hex")}.webp`;
          fs.mkdirSync(uploads, { recursive: true });
          fs.writeFileSync(path.join(uploads, fileName), buf);
          photos.push({ fileName, width: info.width, height: info.height });
        } catch { /* 사진 한 장 실패는 건너뜀 */ }
      }
      const id = db.transaction(() => {
        const cat = db.prepare("select id from categories where name = ?").get(row.category)
          ?? db.prepare("insert into categories (id, name, trial_enabled) values (?, ?, 0) returning id").get(crypto.randomUUID(), row.category);
        const model = db.prepare("select id from product_models where active = 1 and lower(trim(brand)) = lower(?) and lower(trim(model_name)) = lower(?)").get(row.brand, row.modelName)
          ?? db.prepare("insert into product_models (id, brand, model_name, category_id, canonical_spec, active) values (?, ?, ?, ?, ?, 1) returning id")
            .get(crypto.randomUUID(), row.brand, row.modelName, cat.id, JSON.stringify({ source: "DAANGN_IMPORT", createdBy: sellerId }));
        const lid = crypto.randomUUID();
        db.prepare("insert into listings (id, seller_id, model_id, title, price, condition_grade, description, direct_sale_enabled, trial_enabled, status) values (?, ?, ?, ?, ?, ?, ?, 1, 0, 'ACTIVE')")
          .run(lid, sellerId, model.id, row.title, row.price, row.grade, row.description);
        photos.forEach((p, i) => db.prepare("insert into listing_photos (id, listing_id, file_name, width, height, sort_order) values (?, ?, ?, ?, ?, ?)").run(crypto.randomUUID(), lid, p.fileName, p.width, p.height, i));
        db.prepare("insert into market_validation_events (id, event_type, listing_id, model_id, user_id, metadata) values (?, 'SELLER_LISTING_IMPORTED', ?, ?, ?, ?)")
          .run(crypto.randomUUID(), lid, model.id, sellerId, JSON.stringify({ source: "daangn", articleId: it.articleId }));
        return lid;
      })();
      report.imported.push({ listingId: id, title: row.title, price: row.price, grade: row.grade, category: row.category, brand: row.brand, photos: photos.length });
    } catch (e) {
      report.failed.push({ name, reason: String(e.message ?? e).slice(0, 200) });
    }
  }
  fs.writeFileSync(path.join(dir, dry ? "report-dry.json" : `report-${path.basename(dbPath)}.json`), JSON.stringify(report, null, 1));
  console.log(`올림 ${report.imported.length} · 건너뜀 ${report.skipped.length} · 실패 ${report.failed.length}`);
})().catch((e) => { console.error(e); process.exit(1); });
