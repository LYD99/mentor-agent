import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Mentor Agent",
    template: "%s | Mentor Agent",
  },
  description: "AI-powered growth mentor system - Your personal learning companion",
  keywords: ["AI", "learning", "mentor", "growth", "education", "personal development"],
  authors: [{ name: "Mentor Agent Team" }],
  creator: "Mentor Agent",
  publisher: "Mentor Agent",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: "Mentor Agent",
    description: "AI-powered growth mentor system - Your personal learning companion",
    type: "website",
    locale: "zh_CN",
    siteName: "Mentor Agent",
  },
  twitter: {
    card: "summary",
    title: "Mentor Agent",
    description: "AI-powered growth mentor system",
  },
  robots: {
    index: true,
    follow: true,
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
        className={`${display.variable} ${sans.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
