"use client";

import { useState, useCallback } from "react";

interface ShareButtonProps {
  routeId: string;
  departureTime?: Date;
  routeName?: string;
}

export function ShareButton({ routeId, departureTime, routeName }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const getShareUrl = useCallback(() => {
    const url = new URL(`/route/${routeId}`, window.location.origin);
    if (departureTime) {
      url.searchParams.set("depart", departureTime.toISOString());
    }
    return url.toString();
  }, [routeId, departureTime]);

  const handleShare = useCallback(async () => {
    const url = getShareUrl();
    const title = routeName ? `${routeName} on Tailwise` : "Check this route on Tailwise";

    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User cancelled or share failed, fall through to copy
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silent fail
    }
  }, [getShareUrl, routeName]);

  return (
    <button
      onClick={handleShare}
      className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-3.5 text-sm font-medium hover:bg-accent/50 active:bg-accent transition-colors min-h-[48px]"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4.5 w-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16,6 12,2 8,6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
      {copied ? "Link copied!" : "Share this route"}
    </button>
  );
}
