"use client";

import { useState, useEffect, useCallback } from "react";
import { StravaTokens } from "@/lib/types";

const STORAGE_KEY = "tailwise_strava_tokens";

interface StravaAthlete {
  id: number;
  firstName: string;
  profileImage: string;
}

interface UseStravaAuth {
  isConnected: boolean;
  tokens: StravaTokens | null;
  athlete: StravaAthlete | null;
  connect: () => void;
  disconnect: () => void;
  getValidToken: () => Promise<string>;
}

export function useStravaAuth(): UseStravaAuth {
  const [tokens, setTokens] = useState<StravaTokens | null>(null);
  const [athlete, setAthlete] = useState<StravaAthlete | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setTokens(data.tokens);
        setAthlete(data.athlete);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (!code) return;

    // Clean URL
    url.searchParams.delete("code");
    url.searchParams.delete("scope");
    window.history.replaceState({}, "", url.pathname);

    // Exchange code for token
    fetch("/api/auth/strava", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          console.error("Strava auth error:", data.error);
          return;
        }
        const newTokens: StravaTokens = {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
        };
        const newAthlete: StravaAthlete = data.athlete;
        setTokens(newTokens);
        setAthlete(newAthlete);
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ tokens: newTokens, athlete: newAthlete })
        );
      })
      .catch(console.error);
  }, []);

  const connect = useCallback(() => {
    const redirectUri = `${window.location.origin}`;
    const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
    const url =
      `https://www.strava.com/oauth/authorize` +
      `?client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=read` +
      `&approval_prompt=auto`;
    window.location.href = url;
  }, []);

  const disconnect = useCallback(() => {
    setTokens(null);
    setAthlete(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const getValidToken = useCallback(async (): Promise<string> => {
    if (!tokens) throw new Error("Not connected to Strava");

    const now = Math.floor(Date.now() / 1000);
    // Refresh if token expires within 5 minutes
    if (tokens.expiresAt - now > 300) {
      return tokens.accessToken;
    }

    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    const newTokens: StravaTokens = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
    };
    setTokens(newTokens);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tokens: newTokens, athlete })
    );
    return newTokens.accessToken;
  }, [tokens, athlete]);

  return {
    isConnected: tokens !== null,
    tokens,
    athlete,
    connect,
    disconnect,
    getValidToken,
  };
}
