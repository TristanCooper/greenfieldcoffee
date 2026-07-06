import Link from 'next/link';

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-[1180px] px-10 py-16">
        <h1 className="mb-2 text-[32px] tracking-tight text-ink">
          Greenfield Coffee
        </h1>
        <p className="mb-8 max-w-[720px] text-base text-ink-2">
          The operations toolkit for small and medium-sized UK and EU coffee
          roasteries. Roast planning, inventory, orders, and EU Deforestation
          Regulation compliance in one auditable system.
        </p>
        <div className="flex gap-3">
          <Link
            href="/signup"
            className="inline-block rounded border border-accent bg-accent px-3.5 py-2 text-sm text-paper"
          >
            Create your roastery
          </Link>
          <Link
            href="/login"
            className="inline-block rounded border border-accent bg-paper px-3.5 py-2 text-sm text-accent"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}