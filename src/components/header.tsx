"use client";

import { ThemeToggle } from "./theme-toggle";

interface HeaderProps {
  athleteName?: string;
  onDisconnect?: () => void;
  onHome?: () => void;
  showBack?: boolean;
}

export function Header({ athleteName, onDisconnect, onHome, showBack }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border">
      <div className="flex items-center gap-2">
        {showBack && (
          <button
            onClick={onHome}
            className="flex items-center justify-center w-8 h-8 -ml-1 rounded-full hover:bg-accent transition-colors"
            aria-label="Back"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <button
          onClick={onHome}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <svg viewBox="0 0 36 28" className="h-7 w-auto" fill="none">
            {/* Simplified cyclist */}
            <circle cx="12" cy="21" r="5.5" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="25" cy="21" r="5.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M12 21l5-9 5 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M17 12l5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="17" cy="10" r="1.8" fill="currentColor" />
            {/* Wind streaks trailing behind */}
            <path d="M26 9h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
            <path d="M28 12h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
            <path d="M27 15h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.2" />
          </svg>
          <span className="font-semibold text-lg tracking-tight">Tailwise</span>
        </button>
      </div>
      <div className="flex items-center gap-2">
        {athleteName && (
          <button
            onClick={onDisconnect}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {athleteName}
          </button>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
