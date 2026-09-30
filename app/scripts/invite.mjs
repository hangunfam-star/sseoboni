// 테스터 개인 초대 코드 관리 (Gate 0).
// 사용법:
//   npm run invite -- add <닉네임>     새 코드 발급 후 화면에 1회 출력
//   npm run invite -- list             발급 목록(코드는 앞 4자리만 표시)
//   npm run invite -- revoke <코드>    코드 폐기(해당 테스터 세션 즉시 무효)
// 저장 위치: INVITES_FILE 또는 ./invites.local.json (git 추적 제외)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomInt, randomBytes } from "node:crypto";
import path from "node:path";

const file = path.resolve(process.env.INVITES_FILE ?? "./invites.local.json");
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 헷갈리는 0/O/1/I/L 제외
const norm = (c) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");

const load = () => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : []);
const save = (list) => writeFileSync(file, JSON.stringify(list, null, 2) + "\n", "utf8");

function newCode(existing) {
  for (;;) {
    const raw = Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    if (!existing.some((i) => norm(i.code) === raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
  }
}

const [cmd, arg] = process.argv.slice(2);
const list = load();

if (cmd === "add" && arg?.trim()) {
  const nickname = arg.trim();
  if (list.some((i) => !i.revokedAt && i.nickname === nickname)) {
    console.error(`이미 사용 중인 닉네임입니다: ${nickname}`);
    process.exit(1);
  }
  const invite = {
    code: newCode(list),
    nickname,
    userId: `t_${randomBytes(8).toString("hex")}`,
    createdAt: new Date().toISOString(),
    revokedAt: null,
  };
  list.push(invite);
  save(list);
  console.log(`발급 완료 — ${nickname}: ${invite.code}`);
} else if (cmd === "list") {
  for (const i of list) {
    console.log(`${i.code.slice(0, 4)}-****  ${i.nickname}  ${i.revokedAt ? "폐기 " + i.revokedAt : "사용 가능"}`);
  }
  console.log(`총 ${list.length}건 (${file})`);
} else if (cmd === "revoke" && arg) {
  const target = list.find((i) => norm(i.code) === norm(arg) && !i.revokedAt);
  if (!target) {
    console.error("해당 코드가 없거나 이미 폐기됐습니다.");
    process.exit(1);
  }
  target.revokedAt = new Date().toISOString();
  save(list);
  console.log(`폐기 완료 — ${target.nickname}`);
} else {
  console.log("사용법: npm run invite -- add <닉네임> | list | revoke <코드>");
  process.exit(cmd ? 1 : 0);
}
