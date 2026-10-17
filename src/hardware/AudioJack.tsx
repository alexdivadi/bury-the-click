import { TEXT } from '../text.ts';

export function AudioJack({
  label = TEXT.hardware.inputJack,
  onPress,
}: {
  label?: string;
  onPress: () => void;
}) {
  return (
    <div className="input-port">
      <span className="control-label">{label}</span>
      <button
        type="button"
        className="input-jack"
        aria-label={TEXT.hardware.inputSetup(label)}
        title={TEXT.hardware.inputTitle}
        onClick={onPress}
      />
    </div>
  );
}
