const escapeXml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const cell = (value: unknown) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;

const sheet = (name: string, rows: Record<string, unknown>[]) => {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return `<Worksheet ss:Name="${escapeXml(name.slice(0, 31))}"><Table><Row>${keys.map(cell).join("")}</Row>${rows
    .map((row) => `<Row>${keys.map((key) => cell(row[key])).join("")}</Row>`)
    .join("")}</Table></Worksheet>`;
};

export function downloadCustomersExcel(data: {
  customers: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  cards: Record<string, unknown>[];
}) {
  const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Customers"><Table><Row>${Object.keys(data.customers[0] ?? { id: "" }).map(cell).join("")}</Row>${data.customers
    .map((row) => `<Row>${Object.keys(data.customers[0] ?? row).map((key) => cell(row[key])).join("")}</Row>`)
    .join("")}</Table></Worksheet>${sheet("Orders", data.orders)}${sheet("NFC Cards", data.cards)}</Workbook>`;
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tapwash-customers-${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
