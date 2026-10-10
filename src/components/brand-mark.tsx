/**
 * AgentForce "Relay" mark: three agent nodes (Support, Inventory, Sales) hand work
 * along a line that ends in the owner's approval check.
 *
 * - default: full colour, agent dots in their app colours (for light/neutral surfaces)
 * - mono: one colour via `currentColor`, for brand-green or dark tiles; `checkColor`
 *   sets the tick inside the final node so it stays visible.
 */
export function BrandMark({ className, mono = false, checkColor = "#059669" }: { className?: string; mono?: boolean; checkColor?: string }) {
  const c = (color: string) => (mono ? "currentColor" : color);
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden>
      <path d="M8 34 L18 22 L28 30 L38 14" stroke={c("var(--brand)")} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" opacity={mono ? 0.7 : 1} />
      <circle cx="8" cy="34" r="5" fill={c("var(--support)")} />
      <circle cx="18" cy="22" r="5" fill={c("var(--inventory)")} />
      <circle cx="28" cy="30" r="5" fill={c("var(--sales)")} />
      <circle cx="38" cy="14" r="7.5" fill={c("var(--brand)")} />
      <path d="M34.6 14.2 L37 16.6 L41.4 11.8" stroke={mono ? checkColor : "#fff"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
