'use client';

/** Route-level error boundary. Never shows a stack trace to the user. */
export default function ErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--gutter)',
        background: 'var(--base)',
      }}
    >
      <div style={{ maxWidth: 320 }}>
        <h1 style={{ font: 'var(--t-screen-title)', letterSpacing: 'var(--ls-title)' }}>
          Something broke
        </h1>
        <p
          style={{
            marginTop: 8,
            font: 'var(--t-row-artist)',
            color: 'var(--dim)',
          }}
        >
          This screen failed to render. Nothing was lost.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 22,
            minHeight: 'var(--tap)',
            padding: '0 18px',
            borderRadius: 'var(--radius)',
            background: 'var(--bone)',
            color: 'var(--base)',
            font: '600 12px var(--mono)',
            letterSpacing: 'var(--ls-meta)',
          }}
        >
          TRY AGAIN
        </button>
      </div>
    </main>
  );
}
