import type { CSSProperties } from 'react';

/** Inline Omni Extension logo (mirros media/omni-icon.svg) — no asset path needed. */
export function OmniLogo({ size = 15, color, style }: { size?: number; color?: string; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ color, ...style }}
    >
      <g transform="translate(12,12)">
        <circle r="2" fill="currentColor" stroke="none" />
        <path d="M0,-8C3.5,-8 7,-5 7,0C7,4 4,7 0,7C-3,7 -5,4 -3,1" strokeWidth={1.3} />
        <path d="M0,-8C3.5,-8 7,-5 7,0C7,4 4,7 0,7C-3,7 -5,4 -3,1" strokeWidth={1.3} transform="rotate(120)" />
        <path d="M0,-8C3.5,-8 7,-5 7,0C7,4 4,7 0,7C-3,7 -5,4 -3,1" strokeWidth={1.3} transform="rotate(240)" />
        <circle cx="0" cy="-8" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="6.1" cy="4" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="-6.1" cy="4" r="1.1" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}
