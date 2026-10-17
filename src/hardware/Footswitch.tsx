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
      aria-label={running ? 'Stop practice' : 'Start practice'}
      aria-pressed={running}
      disabled={disabled}
      onClick={onPress}
    />
  );
}
