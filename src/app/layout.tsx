import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tailwise | Today's best rides",
  description:
    "Find the best cycling routes for today's wind. Wind-optimised recommendations for Leighton Buzzard and surrounding areas.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Tailwise | Today's best rides",
    description:
      "Find the best cycling routes for today's wind. Wind-optimised recommendations updated live.",
    siteName: "Tailwise",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem enableColorScheme={false}>
          {children}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
