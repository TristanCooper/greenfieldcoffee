import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="text-center">
        <h1 className="mb-2 text-2xl">Not found</h1>
        <p className="mb-4 text-sm text-ink-3">
          That page doesn&rsquo;t exist (yet).
        </p>
        <Link href="/" className="text-accent underline">
          Back to home
        </Link>
      </div>
    </div>
  );
}