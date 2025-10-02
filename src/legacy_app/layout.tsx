import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Navigation/Header";
import { Footer } from "@/components/Navigation/Footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Reset Biology - IRB-Approved Metabolic Freedom",
  description: "Licensed medical provider-led, IRB-approved program for safe, effective peptide therapy and metabolic independence. Access legal Retatrutide protocols with comprehensive support.",
  keywords: "GLP-1, peptide therapy, Retatrutide, metabolic health, weight loss, IRB approved, physician led",
  authors: [{ name: "Reset Biology" }],
  openGraph: {
    title: "Reset Biology - IRB-Approved Metabolic Freedom",
    description: "Is it crazy to want the safest, most effective peptide therapy without breaking the bank?",
    url: "https://resetbiology.com",
    siteName: "Reset Biology",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Reset Biology - IRB-Approved Metabolic Freedom",
    description: "Licensed medical provider-led program for safe, effective peptide therapy and metabolic independence.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased bg-white text-gray-900`}>
        <Providers>
          <Header />
          <main className="pt-16">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
