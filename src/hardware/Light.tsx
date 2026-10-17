export type LightColor = 'off' | 'red' | 'blue' | 'green' | 'warning';

export function Light({ color = 'off' }: { color?: LightColor }) {
  return (
    <span className={`status-light ${color === 'red' ? 'running' : color}`} aria-hidden="true" />
  );
}
