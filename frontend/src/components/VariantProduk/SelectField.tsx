import type { ProductRelation, ProductSize } from "../../api/products";
import { inputCls, labelCls } from "./constants";

export function SelectRelationField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: ProductRelation[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className={labelCls}>
      <span>{label}</span>
      <select className={inputCls} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">Pilih</option>
        {options.map((option) => (
          <option key={option.id} value={String(option.id)}>
            {option.nama}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SelectSizeField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: ProductSize[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className={labelCls}>
      <span>{label}</span>
      <select className={inputCls} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">Pilih</option>
        {options.map((option) => (
          <option key={option.id} value={String(option.id)}>
            {option.nama}
          </option>
        ))}
      </select>
    </label>
  );
}
