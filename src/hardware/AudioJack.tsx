export function AudioJack({ label = 'Input', onPress }: { label?: string; onPress: () => void }) {
  return (
    <div className="input-port">
      <span className="control-label">{label}</span>
      <button
        type="button"
        className="input-jack"
        aria-label={`${label} setup`}
        title="Audio input and calibration"
        onClick={onPress}
      />
    </div>
  );
}
