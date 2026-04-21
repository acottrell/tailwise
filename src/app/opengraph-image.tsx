import { ImageResponse } from "next/og";
import { OUTFIT_FONT_BASE64 } from "@/assets/fonts/outfit-data";

export const alt = "Tailwise — Wind-optimised cycling routes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CREAM = "#f7f3ee";
const BROWN_DARK = "#2a2318";
const BROWN_MUTED = "#8a7d6f";
const BORDER = "#ddd7cd";

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

export default async function Image() {
  const fontData = base64ToArrayBuffer(OUTFIT_FONT_BASE64);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: CREAM,
          fontFamily: "Outfit",
          position: "relative",
        }}
      >
        {/* Top rule */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 80,
            right: 80,
            height: 1,
            backgroundColor: BORDER,
          }}
        />

        {/* Bottom rule */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 80,
            right: 80,
            height: 1,
            backgroundColor: BORDER,
          }}
        />

        {/* Logo lockup: cyclist mark + wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          {/* Cyclist mark — same SVG as header, sized as a companion mark */}
          <svg
            width="44"
            height="34"
            viewBox="0 0 36 28"
            fill="none"
            style={{ marginRight: 16 }}
          >
            <circle cx="12" cy="21" r="5.5" stroke={BROWN_DARK} strokeWidth="1.4" />
            <circle cx="25" cy="21" r="5.5" stroke={BROWN_DARK} strokeWidth="1.4" />
            <path d="M12 21l5-9 5 9" stroke={BROWN_DARK} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M17 12l5-2.5" stroke={BROWN_DARK} strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="17" cy="10" r="1.8" fill={BROWN_DARK} />
            <path d="M26 9h7" stroke={BROWN_DARK} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
            <path d="M28 12h6" stroke={BROWN_DARK} strokeWidth="1.2" strokeLinecap="round" opacity="0.25" />
            <path d="M27 15h5" stroke={BROWN_DARK} strokeWidth="1.2" strokeLinecap="round" opacity="0.15" />
          </svg>

          <div
            style={{
              fontSize: 64,
              fontWeight: 600,
              color: BROWN_DARK,
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            Tailwise
          </div>
        </div>

        {/* Thin rule divider */}
        <div
          style={{
            width: 40,
            height: 1,
            backgroundColor: BROWN_MUTED,
            marginBottom: 24,
            opacity: 0.4,
          }}
        />

        {/* Tagline */}
        <div
          style={{
            fontSize: 20,
            color: BROWN_MUTED,
            letterSpacing: "0.06em",
          }}
        >
          Wind-optimised cycling routes
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Outfit", data: fontData, weight: 600 as const },
      ],
    },
  );
}
