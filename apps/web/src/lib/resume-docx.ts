import "server-only";
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TabStopType, TextRun } from "docx";
import type { ApplicationKit } from "@/lib/agents/application-tailor";

const FONT = "Calibri";
// US Letter width minus side margins (twips), so right-aligned dates land on the margin.
const PAGE_WIDTH = 12240;
const SIDE_MARGIN = 900;
const RIGHT_EDGE = PAGE_WIDTH - SIDE_MARGIN * 2;

const heading = (text: string) =>
  new Paragraph({
    spacing: { before: 240, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 2 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, font: FONT })],
  });

const bulletPara = (text: string) =>
  new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun({ text, size: 21, font: FONT })] });

// Left text with right-aligned text on the same line (e.g. title ... dates).
const splitLine = (left: TextRun[], right: string) =>
  new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_EDGE }],
    spacing: { before: 120 },
    children: [...left, new TextRun({ text: `\t${right}`, size: 21, font: FONT })],
  });

// Single-column, standard headings, no tables or images: parses cleanly in applicant tracking systems.
export async function buildResumeDocx(kit: ApplicationKit): Promise<Buffer> {
  const r = kit.resume;
  const children: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.name, bold: true, size: 36, font: FONT })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: r.headline, size: 22, font: FONT })] }),
  ];
  if (r.contact_line) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: r.contact_line, size: 20, font: FONT, color: "555555" })] }));
  }

  children.push(heading("Summary"), new Paragraph({ children: [new TextRun({ text: r.summary, size: 21, font: FONT })] }));

  if (r.experience.length) {
    children.push(heading("Experience"));
    for (const role of r.experience) {
      children.push(splitLine([new TextRun({ text: role.title, bold: true, size: 22, font: FONT }), new TextRun({ text: ` · ${role.company}`, size: 22, font: FONT })], role.dates));
      if (role.location) children.push(new Paragraph({ children: [new TextRun({ text: role.location, italics: true, size: 20, font: FONT, color: "555555" })] }));
      role.bullets.forEach((b) => children.push(bulletPara(b.text)));
    }
  }

  if (r.skills.length) children.push(heading("Skills"), new Paragraph({ children: [new TextRun({ text: r.skills.join(" · "), size: 21, font: FONT })] }));

  if (r.education.length) {
    children.push(heading("Education"));
    for (const e of r.education) {
      children.push(splitLine([new TextRun({ text: e.degree, bold: true, size: 21, font: FONT }), new TextRun({ text: e.school ? ` · ${e.school}` : "", size: 21, font: FONT })], e.dates));
    }
  }

  for (const section of r.extra_sections) {
    if (!section.items.length) continue;
    children.push(heading(section.heading));
    section.items.forEach((i) => children.push(bulletPara(i)));
  }

  const doc = new Document({
    creator: "Offerwing",
    title: `${r.name} – Resume`,
    sections: [{ properties: { page: { size: { width: PAGE_WIDTH, height: 15840 }, margin: { top: 720, bottom: 720, left: SIDE_MARGIN, right: SIDE_MARGIN } } }, children }],
  });
  return Packer.toBuffer(doc);
}
