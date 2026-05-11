import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VoxTranslate — Real-time Audio Transcription & Translation",
  description: "Accurately listen, transcribe, and translate speech in real-time.",
  keywords: ["transcription", "translation", "speech-to-text", "real-time", "audio"],
  authors: [{ name: "Z.ai Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "VoxTranslate — Real-time Audio Transcription & Translation",
    description: "Accurately listen, transcribe, and translate speech in real-time.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VoxTranslate",
    description: "Real-time speech transcription and translation.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
