import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MathGPT Learning Studio",
  description: "Create mathematics flashcards and worksheets from supplied problems.",
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
