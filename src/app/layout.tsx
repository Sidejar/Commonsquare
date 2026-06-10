import type { Metadata } from "next";
import { Newsreader, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";

const GA_MEASUREMENT_ID = "G-KZ1M8VHKE1";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal"],
  variable: "--font-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CommonSquare — Debate Ideas. Not Political Parties.",
  description:
    "A competitive debate platform where ideas — not parties — climb the ladder. Watch the best arguers make their case, vote on who won, and step into the square yourself.",
  metadataBase: new URL("https://commonsquare.app"),
  openGraph: {
    title: "CommonSquare — Debate Ideas. Not Political Parties.",
    description:
      "A competitive debate platform where ideas — not parties — climb the ladder.",
    siteName: "CommonSquare",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CommonSquare — Debate Ideas. Not Political Parties.",
    description:
      "A competitive debate platform where ideas — not parties — climb the ladder.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${newsreader.variable} ${jetbrainsMono.variable} font-sans antialiased bg-paper text-ink`}
      >
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
