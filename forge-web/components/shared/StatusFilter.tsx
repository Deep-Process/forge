"use client";

interface StatusFilterProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function StatusFilter({ options, value, onChange, label = "Status" }: StatusFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-500">{label}:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border px-2 py-1 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
