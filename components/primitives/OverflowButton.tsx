type Props = { className?: string; label: string; onClick?: () => void };

/** The 2a per-row overflow affordance. The menu itself is not designed in the
 *  canvas and is not built in Phase 3a — this is the trigger only. */
export function OverflowButton({ className, label, onClick }: Props) {
  return (
    <button type="button" className={className} onClick={onClick} aria-label={label}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="5" r="1.7" />
        <circle cx="12" cy="12" r="1.7" />
        <circle cx="12" cy="19" r="1.7" />
      </svg>
    </button>
  );
}
