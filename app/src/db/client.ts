import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

// 운영 DB 파일 경로(탈퇴 2단계 WAL 크기 확인에 쓴다)
export const dbPath = process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./dev.db";
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("secure_delete = ON"); // 지운 내용을 0으로 덮어쓴다(탈퇴 2단계)

export const db = drizzle(sqlite, { schema });
