"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Car, Search, List, Heart, BookMarked, BarChart2, Settings, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const navLinks = [
  { href: "/search", label: "Search", icon: Search },
  { href: "/listings", label: "Listings", icon: List },
  { href: "/saved", label: "Saved", icon: Heart },
  { href: "/searches", label: "Searches", icon: BookMarked },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Nav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [scraperOnline, setScraperOnline] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    fetch("/api/scrape")
      .then((res) => {
        if (res.ok) return res.json()
        throw new Error("offline")
      })
      .then(() => setScraperOnline(true))
      .catch(() => setScraperOnline(false))
  }, [])

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg mr-8">
          <Car className="h-5 w-5 text-primary" />
          <span>CarTrack</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                pathname === href || pathname?.startsWith(href + "/")
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Scraper status */}
        <div className="hidden md:flex items-center gap-2 ml-auto">
          {scraperOnline !== null && (
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  scraperOnline ? "bg-green-500" : "bg-gray-400"
                )}
              />
              <span className={scraperOnline ? "text-green-600" : "text-muted-foreground"}>
                {scraperOnline ? "Live" : "Offline"}
              </span>
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden ml-auto p-2 rounded-md hover:bg-accent"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-background">
          <nav className="flex flex-col py-2 px-4 gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  pathname === href || pathname?.startsWith(href + "/")
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
            {scraperOnline !== null && (
              <div className="flex items-center gap-1.5 text-xs px-3 py-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    scraperOnline ? "bg-green-500" : "bg-gray-400"
                  )}
                />
                <span className={scraperOnline ? "text-green-600" : "text-muted-foreground"}>
                  {scraperOnline ? "Live" : "Offline"}
                </span>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
