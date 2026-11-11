"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/session";
import { CompactSearch } from "./SearchBar";

export function Logo() {
  return (
    <Link href="/" className="shrink-0 font-display text-[30px] leading-none font-semibold tracking-tight">
      fashionlens<span className="text-accent">.</span>
    </Link>
  );
}

// Pages that show the search pill in the header instead of the centre links.
const SEARCH_IN_HEADER = ["/search", "/similar", "/saved", "/history"];

function HeaderSearch() {
  const q = useSearchParams().get("q") ?? "";
  return <CompactSearch key={q} initialQuery={q} />;
}

export default function Navbar() {
  const { user, ready, signOut } = useSession();
  const pathname = usePathname();
  // The menu remembers the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const menuOpen = openOn === pathname;
  const setMenuOpen = (open: boolean | ((o: boolean) => boolean)) =>
    setOpenOn((typeof open === "function" ? open(menuOpen) : open) ? pathname : null);
  const menuRef = useRef<HTMLDivElement>(null);
  const showSearch = SEARCH_IN_HEADER.includes(pathname);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenOn(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const links = [
    { href: "/search", label: "Search" },
    { href: "/saved", label: "Saved" },
    { href: "/history", label: "History" },
    ...(user?.is_admin ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  const isActive = (href: string) => pathname === href || (href === "/search" && pathname === "/");
  const linkClass = (href: string) =>
    isActive(href) ? "border-b-2 border-accent pb-[3px] text-ink" : "border-b-2 border-transparent pb-[3px] text-ink-soft hover:text-ink";

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur-[14px]">
      <nav className="mx-auto flex h-[70px] max-w-[1280px] items-center gap-6 px-4 sm:px-8">
        <Logo />
        {showSearch ? (
          <div className="hidden min-w-0 flex-1 md:block">
            <Suspense fallback={<div className="h-[46px]" />}>
              <HeaderSearch />
            </Suspense>
          </div>
        ) : (
          <div className="hidden flex-1 justify-center gap-[30px] text-sm font-medium md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                {l.label}
              </Link>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2.5 text-sm font-medium" ref={menuRef}>
          {showSearch && (
            <div className="mr-2 hidden gap-6 lg:flex">
              {links.filter((l) => l.href !== "/search").map((l) => (
                <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                  {l.label}
                </Link>
              ))}
            </div>
          )}
          {!ready ? (
            <span className="h-9 w-28" />
          ) : user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-label="Account menu"
                className="grid size-9 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent-dark transition hover:ring-2 hover:ring-accent/30"
              >
                {user.username.slice(0, 1).toUpperCase()}
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-panel">
                  <div className="border-b border-line px-4 py-3">
                    <p className="truncate font-semibold">{user.username}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                  {links.map((l) => (
                    <Link key={l.href} href={l.href} className="block px-4 py-2.5 hover:bg-paper">
                      {l.label}
                    </Link>
                  ))}
                  <button onClick={signOut} className="block w-full border-t border-line px-4 py-2.5 text-left hover:bg-paper">
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="px-3 py-2.5 hover:text-accent-dark">
                Sign in
              </Link>
              <Link href="/register" className="rounded-full bg-accent px-[22px] py-2.5 font-semibold text-white shadow-accent transition hover:bg-accent-dark">
                Join free
              </Link>
            </>
          )}
        </div>
      </nav>
      <div className="border-t border-line px-4 py-2 md:hidden">
        {showSearch ? (
          <Suspense fallback={<div className="h-[46px]" />}>
            <HeaderSearch />
          </Suspense>
        ) : (
          <div className="flex gap-6 overflow-x-auto text-sm font-medium">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={`shrink-0 ${linkClass(l.href)}`}>
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
