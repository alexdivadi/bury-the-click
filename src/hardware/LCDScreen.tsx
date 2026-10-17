import type { ReactNode } from 'react';

/** The physical LCD housing. Each pedal supplies its own layout and readouts. */
export function LCDScreen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="display-window" aria-label={label}>
      {children}
    </section>
  );
}
