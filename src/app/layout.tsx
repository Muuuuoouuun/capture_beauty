import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Oracle Guild",
  description: "Vintage forecasting community with probabilistic reputation"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-30 border-b border-bronze/40 bg-[#e8dfcc]/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
            <div>
              <Link href="/" className="text-2xl font-semibold tracking-wide">Oracle Guild</Link>
              <p className="text-xs text-ink/70">Forecast with evidence. Rise by calibration.</p>
            </div>
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/" className="rounded px-2 py-1 hover:bg-bronze/10">Explore</Link>
              <Link href="/create" className="rounded px-2 py-1 hover:bg-bronze/10">Create</Link>
              <Link href="/admin" className="rounded px-2 py-1 hover:bg-bronze/10">Admin</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-4">{children}</main>
      </body>
    </html>
  );
}
