"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/session";

export function Logo() {
  return (
    <Link href="/" className="font-display text-2xl font-semibold tracking-tight no-underline">
      FashionLens
    </Link>
  );
}

export default function Navbar() {
  const { user, ready, signOut } = useSession();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
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
  const linkClass = (href: string) =>
    pathname === href
      ? "text-ink underline decoration-1 underline-offset-[6px]"
      : "text-ink-soft no-underline hover:text-ink";

  return (
    <header className="border-b border-line bg-paper">
      <nav className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between gap-6 px-4 sm:px-8">
        <Logo />
        <div className="hidden items-center gap-7 text-sm md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-5 text-sm" ref={menuRef}>
          {!ready ? (
            <span className="w-24" />
          ) : user ? (
            <div className="relative">
              <button onClick={() => setMenuOpen((o) => !o)} className="max-w-40 truncate py-2 hover:text-accent-dark" aria-expanded={menuOpen}>
                {user.username}
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-40 mt-2 w-56 border border-line bg-surface">
                  <p className="truncate border-b border-line px-4 py-2.5 text-xs text-muted">{user.email}</p>
                  {links.map((l) => (
                    <Link key={l.href} href={l.href} className="block px-4 py-2.5 no-underline hover:bg-paper md:hidden">
                      {l.label}
                    </Link>
                  ))}
                  <button onClick={signOut} className="block w-full px-4 py-2.5 text-left hover:bg-paper">
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="no-underline hover:text-accent-dark">
                Sign in
              </Link>
              <Link href="/register" className="rounded-[2px] bg-ink px-4 py-2.5 text-paper no-underline hover:bg-accent-dark">
                Join free
              </Link>
            </>
          )}
        </div>
      </nav>
      <div className="flex gap-6 overflow-x-auto border-t border-line px-4 py-2.5 text-sm md:hidden">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={`shrink-0 ${linkClass(l.href)}`}>
            {l.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
