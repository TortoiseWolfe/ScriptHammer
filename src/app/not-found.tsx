import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold">404</h1>
        <h2 className="mb-4 text-2xl">Page Not Found</h2>
        {/* Solid, not `/80` (#425). The opacity suffix measured 6.62:1 on
            scripthammer-light — under the 7:1 AAA gate, same failure mode as
            #411 and #415. */}
        <p className="text-base-content mb-8">
          The page you are looking for doesn&apos;t exist.
        </p>
        <Link href="/" className="btn btn-primary">
          Go Home
        </Link>
      </div>
    </div>
  );
}
