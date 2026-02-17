/**
 * Download an array of objects as a CSV file.
 * Handles quoting fields that contain commas, quotes, or newlines.
 */
export function downloadCsv(
  rows: Record<string, string | number | boolean | null | undefined>[],
  filename: string,
  columns?: { key: string; label: string }[]
) {
  if (rows.length === 0) return;

  const keys = columns?.map((c) => c.key) ?? Object.keys(rows[0]);
  const headers = columns?.map((c) => c.label) ?? keys;

  const escape = (val: unknown): string => {
    const str = val == null ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    headers.map(escape).join(','),
    ...rows.map((row) => keys.map((k) => escape(row[k])).join(',')),
  ];

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
