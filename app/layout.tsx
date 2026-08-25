import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://aydinol-create.github.io/bess-engineering-health-check"),
  title: "BESS Engineering Health Check",
  description: "A transparent, configurable engineering screening tool for utility-scale battery energy storage systems.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "BESS Engineering Health Check",
    description: "Enter battery, thermal, protection, PCS, transformer, and plant readings to produce a traceable engineering assessment.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "BESS Engineering Health Check" }],
  },
  twitter: { card: "summary_large_image", title: "BESS Engineering Health Check", description: "Configurable engineering screening for utility-scale battery systems.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
