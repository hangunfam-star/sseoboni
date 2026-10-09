"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive, type NavItem } from "@/ui/navigation";

function NavIcon({ label, active }: { label: NavItem["label"]; active: boolean }) {
  const stroke = "currentColor";
  switch (label) {
    case "홈":
      return <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? stroke : "none"} stroke={stroke} strokeWidth="2" strokeLinejoin="round"><path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" /></svg>;
    case "찾는 상품":
      return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
    case "판매하기":
      return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
    case "찜":
      return <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? stroke : "none"} stroke={stroke} strokeWidth="2" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 000-7.8z" /></svg>;
    case "MY":
      return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></svg>;
  }
}

export function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login" || /^\/orders\/[^/]+$/.test(pathname) || pathname.startsWith("/admin") || /^\/chats\/[^/]+$/.test(pathname) || /^\/listings\/(?!new$)[^/]+$/.test(pathname)) return null;

  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {NAV_ITEMS.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        const sell = item.label === "판매하기";
        return (
          <Link
            key={item.href}
            href={item.href}
            className={sell ? "bottom-nav__item bottom-nav__sell" : "bottom-nav__item"}
            aria-current={active ? "page" : undefined}
            aria-label={sell ? "판매하기" : undefined}
          >
            <NavIcon label={item.label} active={active} />
            {!sell && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
