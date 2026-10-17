import { TEXT } from '../text.ts';

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
      aria-label={running ? TEXT.hardware.footswitchOn : TEXT.hardware.footswitchOff}
      aria-pressed={running}
      disabled={disabled}
      onClick={onPress}
    />
  );
}
