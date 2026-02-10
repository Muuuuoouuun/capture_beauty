import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "g2 | Judgment-led SaaS + AI Reviews",
  description: "Human-centered reviews of SaaS and AI tools, grounded in judgment and impact."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/">
            <strong>g2</strong>
          </Link>
          <div className="nav-links">
            <Link href="/search">Search</Link>
            <Link href="/about">About</Link>
          </div>
        </nav>
        {children}
        <footer>Built for human judgment. Powered by curated experience.</footer>
      </body>
    </html>
  );
}
