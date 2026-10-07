import { jsPDF } from "jspdf";

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Converts the existing printable report HTML into a real, server-generated
 * PDF. It intentionally consumes the same printable HTML source so all
 * report metadata, financial/inventory values, and audit-note text remain in
 * one report representation.
 */
export function printableMonthlyHtmlToPdf(
  printableHtml: string,
  metadata: { title?: string; subject?: string; creationDate?: Date; /** 32 hex chars; makes the PDF trailer ID (otherwise random) deterministic. */ fileId?: string } = {},
) {
  const plainText = decodeHtml(
    printableHtml
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<(br|\/p|\/h1|\/h2|\/tr|\/li|\/table|\/ul)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+\n/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );

  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: false });
  pdf.setProperties({
    title: metadata.title ?? "StoreOS Monthly Management Report",
    subject: metadata.subject ?? "Read-only monthly financial and inventory management report",
    author: "StoreOS",
    creator: "StoreOS server-side report generator",
  });
  if (metadata.creationDate) pdf.setCreationDate(metadata.creationDate);
  if (metadata.fileId) pdf.setFileId(metadata.fileId);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 42;
  const lineHeight = 15;
  const lines = pdf.splitTextToSize(plainText, pageWidth - margin * 2) as string[];
  let y = margin;
  for (const line of lines) {
    if (y > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.text(line, margin, y);
    y += lineHeight;
  }

  return Buffer.from(pdf.output("arraybuffer"));
}
