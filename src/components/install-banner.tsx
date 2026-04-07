"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallBanner() {
  const [show, setShow] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Don't show if already dismissed or already in standalone mode
    if (localStorage.getItem("tw_installDismissed")) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const firstSeen = localStorage.getItem("tw_firstSeen");
    if (!firstSeen) {
      // First visit — just record it, don't show banner
      localStorage.setItem("tw_firstSeen", Date.now().toString());
      return;
    }

    // Return visit — show banner after a short delay
    const timer = setTimeout(() => setShow(true), 2000);

    // Capture the browser install prompt if available
    function handlePrompt(e: Event) {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
    }
    window.addEventListener("beforeinstallprompt", handlePrompt);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handlePrompt);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt.current) {
      await deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === "accepted") {
        setShow(false);
        localStorage.setItem("tw_installDismissed", "1");
      }
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setShow(false);
    localStorage.setItem("tw_installDismissed", "1");
  }, []);

  if (!show) return null;

  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 p-3 animate-in slide-in-from-bottom duration-300"
      style={{ animation: "fadeSlideUp 300ms ease-out forwards" }}
    >
      <div className="max-w-2xl mx-auto flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Use Tailwise from your home screen</p>
          {isIOS && !deferredPrompt.current && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Tap Share → Add to Home Screen
            </p>
          )}
        </div>
        {deferredPrompt.current ? (
          <button
            onClick={handleInstall}
            className="shrink-0 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium min-h-[40px]"
          >
            Install
          </button>
        ) : null}
        <button
          onClick={handleDismiss}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors text-muted-foreground"
          aria-label="Dismiss"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
