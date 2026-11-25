'use client';

import Link from 'next/link';

export function PrintButton() {
  return (
    <div className="no-print" style={{ display: 'flex', gap: 10 }}>
      <Link href="/" className="btn btn-secondary btn-sm">
        &larr; Back to Storefront
      </Link>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => window.print()}
      >
        Print / Save PDF Invoice
      </button>
    </div>
  );
}
