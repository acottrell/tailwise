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
          <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none">
            <circle cx="12" cy="22" r="5" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="24" cy="22" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 22l4-8 4 8M16 14l4-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="16" cy="12" r="1.5" fill="currentColor" />
            <path d="M2 8h7M1 11h6M3 14h5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
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
