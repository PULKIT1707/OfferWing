export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 17c5-1 9-5 11-12 1 5-1 10-5 13" fill="currentColor" opacity=".55" />
        <path d="M8 20c6 0 11-4 13-11-3 3-7 4-11 4" fill="var(--wing)" />
      </svg>
      Offerwing
    </span>
  );
}
