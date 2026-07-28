"use client";

export type FieldDef = {
  key: string;
  label: string;
  help: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  // Used when the API's params payload doesn't have the key yet (older API).
  fallback: number;
};

export function SliderField({
  def,
  value,
  onChange,
}: {
  def: FieldDef;
  value: number;
  onChange: (key: string, value: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={def.key} className="text-sm text-slate-700">
          {def.label}
        </label>
        <span className="font-mono text-sm font-semibold text-brand-dark">
          {value}
          {def.unit ?? ""}
        </span>
      </div>
      <input
        id={def.key}
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={(e) => onChange(def.key, Number(e.target.value))}
        className="w-full accent-brand"
      />
      <p className="text-xs text-slate-400">{def.help}</p>
    </div>
  );
}
