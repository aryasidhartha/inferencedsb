import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InferenceAdvisor | Enterprise LLM & GPU Infrastructure Sizer",
  description:
    "Physics-based GPU roofline modeling, VRAM capacity planning, and cost-per-token efficiency analysis for self-hosted open-source LLMs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#09090b] text-zinc-100 antialiased selection:bg-indigo-500/25 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
