import Link from "next/link";

export function Hero() {
  return (
    <section className="hero">
      <div>
        <h1>You don’t need more tools. You need better judgment.</h1>
        <p>
          g2 curates SaaS and AI tools through a human lens—highlighting how they shape thinking,
          time, and trust.
        </p>
      </div>
      <div>
        <Link className="button" href="/search">
          Find tool by your problem situation →
        </Link>
      </div>
    </section>
  );
}
