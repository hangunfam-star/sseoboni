import test from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, isNavItemActive } from "./navigation";

test("하단 메뉴는 Gate 0 다섯 항목을 노출한다", () => {
  assert.deepEqual(NAV_ITEMS.map((item) => item.label), ["홈", "찾는 상품", "판매하기", "찜", "MY"]);
});

test("하위 경로에서도 해당 메뉴가 활성화된다", () => {
  assert.equal(isNavItemActive("/listings/new", "/listings/new"), true);
  assert.equal(isNavItemActive("/demand/history", "/demand"), true);
  assert.equal(isNavItemActive("/login", "/"), false);
});
