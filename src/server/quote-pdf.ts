import "server-only";
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { quoteNumber, type QuoteDetail } from "./quotes";

const FONT = path.join(process.cwd(), "src/assets/fonts/DejaVuSans.ttf");
const FONT_BOLD = path.join(process.cwd(), "src/assets/fonts/DejaVuSans-Bold.ttf");
const LOGO = path.join(process.cwd(), "public/brand/logo-light.png");

const GREEN = "#1f7a3a";
const INK = "#0d120e";
const MUTED = "#5f6b61";
const RULE = "#e1e6e1";
const TINT = "#eef2ee";

const inr = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (v: string | number) => `₹${inr.format(Number(v))}`;
const day = (v: Date | string | null) => (v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "Not set");

/** Renders a quote as an A4 PDF, laid out like the Laravel quote print: header, meta, bill to, items, totals. */
export function renderQuotePdf(q: QuoteDetail): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true, info: { Title: `${quoteNumber(q.id)} ${q.subject}`, Author: "Deboistech", Producer: "deboTrack" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("r", FONT);
    doc.registerFont("b", FONT_BOLD);

    const left = 40;
    const right = doc.page.width - 40;
    const width = right - left;
    const bottom = doc.page.height - 70;

    // ---- header
    if (fs.existsSync(LOGO)) doc.image(LOGO, left, 36, { height: 34 });
    doc.font("b").fontSize(22).fillColor(GREEN).text("QUOTE", left, 36, { width, align: "right" });
    doc.font("r").fontSize(10).fillColor(MUTED).text(quoteNumber(q.id), left, 62, { width, align: "right" });
    doc.moveTo(left, 86).lineTo(right, 86).lineWidth(1.5).strokeColor(GREEN).stroke();

    // ---- meta (left) and bill to (right)
    let y = 102;
    const meta: [string, string][] = [
      ["Subject", q.subject],
      ["Date", day(q.createdAt)],
      ["Valid until", day(q.expiredAt)],
      ["Sales person", q.owner ?? "Not set"],
    ];
    const colW = width / 2 - 12;
    let my = y;
    for (const [k, v] of meta) {
      doc.font("b").fontSize(9).fillColor(MUTED).text(k, left, my, { width: 80 });
      doc.font("r").fontSize(10).fillColor(INK).text(v, left + 84, my, { width: colW - 84 });
      my = Math.max(my + 16, doc.y + 4);
    }

    const bx = left + width / 2 + 12;
    doc.font("b").fontSize(9).fillColor(MUTED).text("Bill to", bx, y, { width: colW });
    let by = y + 14;
    doc.font("b").fontSize(11).fillColor(INK).text(q.learner, bx, by, { width: colW });
    by = doc.y + 2;
    const lines = [q.recipientContact, q.phones[0], q.emails[0], q.billingAddress?.address, [q.billingAddress?.city, q.billingAddress?.postcode].filter(Boolean).join(" "), q.billingAddress?.state, q.billingAddress?.country].filter(Boolean) as string[];
    doc.font("r").fontSize(10).fillColor(INK);
    for (const l of lines) {
      doc.text(l, bx, by, { width: colW });
      by = doc.y + 1;
    }
    y = Math.max(my, by) + 14;

    // ---- description
    if (q.description) {
      doc.font("b").fontSize(9).fillColor(MUTED).text("Description", left, y);
      doc.font("r").fontSize(10).fillColor(INK).text(q.description, left, doc.y + 3, { width });
      y = doc.y + 14;
    }

    // ---- items
    const cols = [
      { key: "n", label: "#", x: left, w: 22, align: "left" as const },
      { key: "name", label: "Item", x: left + 22, w: 196, align: "left" as const },
      { key: "price", label: "Price", x: left + 218, w: 72, align: "right" as const },
      { key: "qty", label: "Qty", x: left + 290, w: 34, align: "right" as const },
      { key: "disc", label: "Discount", x: left + 324, w: 64, align: "right" as const },
      { key: "tax", label: "Tax", x: left + 388, w: 58, align: "right" as const },
      { key: "total", label: "Total", x: left + 446, w: width - 446, align: "right" as const },
    ];
    const headerRow = (at: number) => {
      doc.rect(left, at, width, 22).fill(TINT);
      doc.font("b").fontSize(9).fillColor(GREEN);
      for (const c of cols) doc.text(c.label, c.x + 4, at + 7, { width: c.w - 8, align: c.align });
      return at + 22;
    };
    y = headerRow(y);

    q.items.forEach((it, i) => {
      const nameText = it.sku ? `${it.name}\nSKU: ${it.sku}` : it.name;
      doc.font("r").fontSize(10);
      const h = Math.max(24, doc.heightOfString(nameText, { width: cols[1]!.w - 8 }) + 12);
      if (y + h > bottom) {
        doc.addPage();
        y = headerRow(40);
      }
      doc.font("r").fontSize(10).fillColor(MUTED).text(String(i + 1), cols[0]!.x + 4, y + 7, { width: cols[0]!.w - 8 });
      doc.fillColor(INK).text(it.name, cols[1]!.x + 4, y + 7, { width: cols[1]!.w - 8 });
      if (it.sku) doc.fontSize(8).fillColor(MUTED).text(`SKU: ${it.sku}`, cols[1]!.x + 4, doc.y + 1, { width: cols[1]!.w - 8 });
      doc.fontSize(10).fillColor(INK);
      const d = Number(it.discountAmount) > 0 ? money(it.discountAmount) : "None";
      const t = Number(it.taxAmount) > 0 ? money(it.taxAmount) : "None";
      doc.text(money(it.price), cols[2]!.x + 4, y + 7, { width: cols[2]!.w - 8, align: "right" });
      doc.text(String(it.quantity), cols[3]!.x + 4, y + 7, { width: cols[3]!.w - 8, align: "right" });
      doc.text(d, cols[4]!.x + 4, y + 7, { width: cols[4]!.w - 8, align: "right" });
      doc.text(t, cols[5]!.x + 4, y + 7, { width: cols[5]!.w - 8, align: "right" });
      doc.font("b").text(money(it.total), cols[6]!.x + 4, y + 7, { width: cols[6]!.w - 8, align: "right" });
      y += h;
      doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor(RULE).stroke();
    });

    // ---- totals
    const rows: [string, string, boolean][] = [
      ["Sub total", money(q.subTotal), false],
      ["Discount", Number(q.discountAmount) > 0 ? `− ${money(q.discountAmount)}` : "None", false],
      ["Tax", money(q.taxAmount), false],
    ];
    if (Number(q.adjustmentAmount) !== 0) rows.push(["Adjustment", `${Number(q.adjustmentAmount) < 0 ? "− " : ""}${money(Math.abs(Number(q.adjustmentAmount)))}`, false]);
    rows.push(["Grand total", money(q.grandTotal), true]);
    const boxH = rows.length * 20 + 10;
    if (y + 16 + boxH > bottom) {
      doc.addPage();
      y = 40 - 16;
    }
    y += 16;
    const bw = 250;
    const bxl = right - bw;
    doc.rect(bxl, y, bw, boxH).fill(TINT);
    let ry = y + 9;
    for (const [k, v, strong] of rows) {
      if (strong) doc.moveTo(bxl + 12, ry - 4).lineTo(right - 12, ry - 4).lineWidth(0.5).strokeColor(GREEN).stroke();
      doc.font(strong ? "b" : "r").fontSize(strong ? 12 : 10).fillColor(strong ? GREEN : INK);
      doc.text(k, bxl + 12, ry, { width: 110 });
      doc.text(v, bxl + 120, ry, { width: bw - 132, align: "right" });
      ry += 20;
    }

    // ---- footer on every page
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.font("r").fontSize(8).fillColor(MUTED);
      doc.text(`Deboistech · ${quoteNumber(q.id)}${q.expiredAt ? ` · valid until ${day(q.expiredAt)}` : ""}`, left, doc.page.height - 52, { width: width - 80, align: "left", lineBreak: false });
      doc.text(`Page ${i + 1} of ${range.count}`, right - 80, doc.page.height - 52, { width: 80, align: "right", lineBreak: false });
    }
    doc.end();
  });
}
