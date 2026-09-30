export type NavItem = {
  href: string;
  label: "홈" | "찾는 상품" | "판매하기" | "찜" | "MY";
  glyph: string;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "홈", glyph: "⌂" },
  { href: "/demand", label: "찾는 상품", glyph: "⌕" },
  { href: "/listings/new", label: "판매하기", glyph: "+" },
  { href: "/wishlist", label: "찜", glyph: "♡" },
  { href: "/me", label: "MY", glyph: "●" },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
