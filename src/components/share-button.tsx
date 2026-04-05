"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  routeId: string;
  departureTime?: Date;
}

export function ShareButton({ routeId, departureTime }: ShareButtonProps) {
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

    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Tailwise",
          url,
        });
        return;
      } catch {
        // User cancelled or share failed — fall through to copy
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
  }, [getShareUrl]);

  return (
    <Button variant="outline" size="sm" onClick={handleShare}>
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 mr-1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16,6 12,2 8,6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
      {copied ? "Copied!" : "Share"}
    </Button>
  );
}
