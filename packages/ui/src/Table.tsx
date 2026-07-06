import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  width?: string;
}

export function Table<T>({ columns, rows, empty }: { columns: Column<T>[]; rows: T[]; empty?: ReactNode }) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              style={c.width ? { width: c.width } : undefined}
              className="border-b border-line-2 px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-3"
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="hover:bg-[#fafaf5]">
            {columns.map((c) => (
              <td key={c.key} className="border-b border-line-2 px-2.5 py-2 align-top text-ink">
                {c.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}