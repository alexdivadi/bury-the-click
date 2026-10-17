import type { ReactNode } from 'react';

export type PedalTexture = 'powder-coat' | 'woodgrain' | 'plain';

export function Pedal({
  children,
  texture = 'powder-coat',
  label,
  className = '',
}: {
  children: ReactNode;
  texture?: PedalTexture;
  label: string;
  className?: string;
}) {
  return (
    <main className={`pedal pedal--${texture} ${className}`} aria-label={label}>
      {['tl', 'tr', 'bl', 'br'].map((corner) => (
        <span key={corner} className={`screw screw-${corner}`} aria-hidden="true" />
      ))}
      {children}
    </main>
  );
}
