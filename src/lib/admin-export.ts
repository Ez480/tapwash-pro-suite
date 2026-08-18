const escapeCsv = (value: unknown) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const rowsToCsv = (rows: Record<string, unknown>[]) => {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const header = keys.map(escapeCsv).join(",");
  const body = rows.map((row) => keys.map((key) => escapeCsv(row[key])).join(",")).join("\r\n");
  return [header, body].filter(Boolean).join("\r\n");
};

/**
 * Excel on Android/iOS is much more reliable with a UTF-8 CSV than the old
 * SpreadsheetML .xls payload. Keep one export file, but clearly separate the
 * three datasets so the customer/admin can open it directly in Excel mobile.
 */
export function downloadCustomersExcel(data: {
  customers: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  cards: Record<string, unknown>[];
}) {
  const sections = [
    ["TapWash Customers", data.customers],
    ["TapWash Orders", data.orders],
    ["TapWash NFC Cards", data.cards],
  ];

  const csv = sections
    .map(([title, rows]) => `${escapeCsv(title)}\r\n${rowsToCsv(rows as Record<string, unknown>[])}`)
    .join("\r\n\r\n");

  // UTF-8 BOM makes Arabic text render correctly in Microsoft Excel mobile.
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tapwash-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
