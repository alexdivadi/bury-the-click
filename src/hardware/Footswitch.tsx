export function Footswitch({
  running,
  disabled,
  onPress,
}: {
  running: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      className="footswitch"
      aria-label={running ? 'ON' : 'OFF'}
      aria-pressed={running}
      disabled={disabled}
      onClick={onPress}
    />
  );
}
