"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICON = {
  home: <path d="M3 11l9-7 9 7M5 10v10h14V10" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  sell: <path d="M12 5v14M5 12h14" />,
  heart: <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 000-7.8z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></>,
  chat: <path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
};

const ITEMS: { href: string; label: string; icon: keyof typeof ICON }[] = [
  { href: "/", label: "홈", icon: "home" },
  { href: "/demand", label: "찾는 상품", icon: "search" },
  { href: "/listings/new", label: "내 물건 팔기", icon: "sell" },
  { href: "/wishlist", label: "찜", icon: "heart" },
  { href: "/me", label: "MY", icon: "user" },
  { href: "/feedback", label: "의견 보내기", icon: "chat" },
];

// param: showAdmin 이 PC에서 직접 연 경우(localhost) true — 운영자 결과 링크를 보여 준다.
// return: 오른쪽 위 햄버거 버튼과 오른쪽에서 열리는 메뉴
export function TopMenu({ showAdmin }: { showAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  if (pathname === "/login") return null;
  const items = showAdmin ? [...ITEMS, { href: "/admin", label: "운영자 결과 (이 PC)", icon: "chart" as const }] : ITEMS;

  return (
    <>
      <button ref={button} type="button" className="top-menu__button" aria-label="메뉴 열기" aria-expanded={open} aria-controls="top-menu" onClick={() => setOpen(true)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {open && (
        <div className="top-menu" role="presentation" onClick={() => setOpen(false)}>
          <div ref={panel} id="top-menu" className="top-menu__panel" role="dialog" aria-modal="true" aria-label="메뉴" onClick={(e) => e.stopPropagation()}>
            <div className="top-menu__head">
              <span className="wordmark">써보니<span>.</span></span>
              <button type="button" className="icon-button" aria-label="메뉴 닫기" onClick={() => { setOpen(false); button.current?.focus(); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <nav>
              <ul>
                {items.map((it) => (
                  <li key={it.href}>
                    <Link href={it.href} aria-current={pathname === it.href ? "page" : undefined} onClick={() => setOpen(false)} className={it.href === "/admin" ? "top-menu__admin" : undefined}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[it.icon]}</svg>
                      {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <p className="top-menu__note">테스트 기간이에요. 결제와 배송은 일어나지 않아요.</p>
          </div>
        </div>
      )}
    </>
  );
}
