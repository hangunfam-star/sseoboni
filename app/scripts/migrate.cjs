/* eslint-disable @typescript-eslint/no-require-imports -- Node 운영 스크립트(CommonJS) */
// DB에 drizzle 마이그레이션(drizzle 폴더)을 적용한다. 이미 적용된 것은 건너뛴다.
// 사용: node scripts/migrate.cjs <DB 경로>   (서버: docker exec sseoboni node scripts/migrate.cjs /data/dev.db)
const path = require("node:path");
const Database = require("better-sqlite3");
const { drizzle } = require("drizzle-orm/better-sqlite3");
const { migrate } = require("drizzle-orm/better-sqlite3/migrator");

const dbPath = process.argv[2];
if (!dbPath) { console.error("DB 경로를 넣어 주세요"); process.exit(1); }
const sqlite = new Database(dbPath);
migrate(drizzle(sqlite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
console.log("적용된 마이그레이션", sqlite.prepare("select count(*) n from __drizzle_migrations").get().n);
