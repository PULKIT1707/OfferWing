// Builds the binary test fixtures (resume PDF/DOCX, LinkedIn PDF, LinkedIn export ZIP, alert
// email, ATS form) from fixtures/dummy-data.json. Run from the repo root:
//   node e2e/generate-fixtures.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// Reuse the web app's dependencies instead of adding a package here.
const require = createRequire(join(here, "../apps/web/package.json"));
const { zipSync, strToU8 } = require("fflate");
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require("docx");

const data = JSON.parse(readFileSync(join(here, "fixtures/dummy-data.json"), "utf8"));
const out = join(here, "fixtures/generated");
mkdirSync(out, { recursive: true });
const r = data.resume;

// Resume as plain lines, shared by the PDF and DOCX versions.
const resumeLines = [
  r.name,
  r.headline,
  `${r.contact.email} | ${r.contact.phone} | ${r.contact.location}`,
  `${r.contact.linkedin} | ${r.contact.github}`,
  "",
  "Summary",
  r.summary,
  "",
  "Experience",
  ...r.experience.flatMap((e) => [`${e.title}, ${e.company} - ${e.location}`, e.dates, ...e.bullets.map((b) => `- ${b}`), ""]),
  "Skills",
  r.skills.join(", "),
  "",
  "Education",
  ...r.education.map((e) => `${e.degree}, ${e.school}, ${e.dates}`),
  "",
  "Certifications",
  ...r.certifications,
];

// Minimal text PDF (Helvetica, Letter size, wrapped lines, multiple pages) that unpdf can extract.
function wrap(line, width = 95) {
  if (line.length <= width) return [line];
  const words = line.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > width) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}
function makePdf(lines) {
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const wrapped = lines.flatMap((l) => (l ? wrap(l) : [""]));
  const perPage = 50;
  const pages = [];
  for (let i = 0; i < wrapped.length; i += perPage) pages.push(wrapped.slice(i, i + perPage));
  const objs = [];
  const add = (body) => objs.push(body) && objs.length;
  const catalog = add(null);
  const pagesObj = add(null);
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds = [];
  for (const p of pages) {
    const stream = `BT /F1 10 Tf 14 TL 50 750 Td\n${p.map((l) => `(${esc(l)}) Tj T*`).join("\n")}\nET`;
    const content = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

writeFileSync(join(out, "jordan-rivera-resume.pdf"), makePdf(resumeLines));

// LinkedIn's "Save to PDF" profile layout: Contact / Top Skills / Summary / Experience / Education.
const linkedinLines = [
  "Contact",
  r.contact.linkedin + " (LinkedIn)",
  "Top Skills",
  ...r.skills.slice(0, 3),
  "Certifications",
  ...r.certifications,
  "",
  r.name,
  "Backend engineer | Payments and ledgers | Go, Python, PostgreSQL",
  r.contact.location,
  "Summary",
  "I build payment and data platforms. Most recently I led a ledger migration to event sourcing at Ledgerly.",
  "Experience",
  ...r.experience.flatMap((e) => [e.company, e.title, e.dates, e.location, ""]),
  "Education",
  ...r.education.map((e) => `${e.school}\n${e.degree} · (${e.dates})`).flatMap((s) => s.split("\n")),
];
writeFileSync(join(out, "jordan-rivera-linkedin.pdf"), makePdf(linkedinLines));

const doc = new Document({
  sections: [
    {
      children: resumeLines.map((line, i) =>
        ["Summary", "Experience", "Skills", "Education", "Certifications"].includes(line)
          ? new Paragraph({ text: line, heading: HeadingLevel.HEADING_2 })
          : new Paragraph({ children: [new TextRun({ text: line, bold: i === 0 })] }),
      ),
    },
  ],
});
writeFileSync(join(out, "jordan-rivera-resume.docx"), await Packer.toBuffer(doc));

// LinkedIn data export ZIP. Connections.csv has LinkedIn's "Notes:" preamble and an email column
// (which the parser must drop).
const slug = (c) => `${c.first}-${c.last}-owtest`.toLowerCase();
const csv = (rows) => rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
const conns = data.linkedin_export.connections;
const connectionsCsv =
  'Notes:\n"When exporting your connection data, you may notice that some of the email addresses are missing."\n\n' +
  csv([
    ["First Name", "Last Name", "URL", "Email Address", "Company", "Position", "Connected On"],
    ...conns.map((c) => [c.first, c.last, `https://www.linkedin.com/in/${slug(c)}`, `${c.first.toLowerCase()}@example.com`, c.company, c.position, c.connected_on]),
  ]);
const me = "https://www.linkedin.com/in/jordan-rivera-owtest";
const messageRows = [["CONVERSATION ID", "CONVERSATION TITLE", "FROM", "SENDER PROFILE URL", "TO", "RECIPIENT PROFILE URLS", "DATE", "SUBJECT", "CONTENT", "FOLDER"]];
const now = Date.now();
conns.forEach((c, ci) => {
  for (let i = 0; i < c.messages; i++) {
    const date = new Date(now - (ci * 20 + i * 3) * 86400000).toISOString().replace("T", " ").slice(0, 19) + " UTC";
    const fromThem = i % 2 === 0;
    const them = `https://www.linkedin.com/in/${slug(c)}`;
    messageRows.push([`conv-${ci}`, "", fromThem ? `${c.first} ${c.last}` : r.name, fromThem ? them : me, fromThem ? r.name : `${c.first} ${c.last}`, fromThem ? me : them, date, "", "Synthetic message body", "INBOX"]);
  }
});
const positionsCsv = csv([
  ["Company Name", "Title", "Description", "Location", "Started On", "Finished On"],
  ...r.experience.map((e) => [e.company, e.title, "", e.location, e.dates.split(" - ")[0], e.dates.split(" - ")[1] === "Present" ? "" : e.dates.split(" - ")[1]]),
]);
writeFileSync(
  join(out, "linkedin-export.zip"),
  zipSync({
    "Connections.csv": strToU8(connectionsCsv),
    "messages.csv": strToU8(csv(messageRows)),
    "Positions.csv": strToU8(positionsCsv),
    "Profile.csv": strToU8('"First Name","Last Name"\n"Jordan","Rivera"'),
  }),
);

// LinkedIn job-alert email as an inbound-email provider (Postmark) would POST it.
const alertJobs = data.linkedin_alert_email.jobs;
const html =
  "<html><body><h2>Your job alert for Senior Backend Engineer</h2><table>" +
  alertJobs
    .map(
      (j) =>
        `<tr><td><a href="https://www.linkedin.com/comm/jobs/view/${j.id}/?trackingId=abc%3D%3D&amp;refId=xyz">${j.title}</a></td></tr>` +
        `<tr><td>${j.company} · ${j.location}</td></tr><tr><td><a href="https://www.linkedin.com/comm/jobs/view/${j.id}/">View job</a></td></tr>`,
    )
    .join("") +
  "</table></body></html>";
const text = alertJobs.map((j) => `${j.title}\n${j.company}\n${j.location}\nView job: https://www.linkedin.com/comm/jobs/view/${j.id}/?trk=eml\n`).join("\n");
writeFileSync(
  join(out, "inbound-alert-postmark.json"),
  JSON.stringify(
    {
      From: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
      To: "REPLACE_WITH_ALERT_ALIAS@alerts.offerwing.app",
      OriginalRecipient: "REPLACE_WITH_ALERT_ALIAS@alerts.offerwing.app",
      Subject: '"Senior Backend Engineer": Mercury - Senior Backend Engineer and more',
      HtmlBody: html,
      TextBody: text,
    },
    null,
    2,
  ),
);

// A Greenhouse-style application form for the extension's autofill, including fields autofill
// must leave alone (demographics, consent) and an open question for drafted answers.
writeFileSync(
  join(out, "greenhouse-form.html"),
  `<!doctype html>
<html><head><meta charset="utf-8"><title>Job Application for Senior Backend Engineer, Payments at Stripe</title></head>
<body>
<div id="app_body"><h1 class="app-title">Senior Backend Engineer, Payments</h1><span class="company-name">at Stripe</span>
<div id="content"><p>We're looking for a Senior Backend Engineer to join our Payments Core team.</p></div>
<form id="application_form" action="#" onsubmit="alert('SUBMITTED'); return false;">
  <label for="first_name">First Name *</label><input id="first_name" name="job_application[first_name]" type="text">
  <label for="last_name">Last Name *</label><input id="last_name" name="job_application[last_name]" type="text">
  <label for="email">Email *</label><input id="email" name="job_application[email]" type="email">
  <label for="phone">Phone</label><input id="phone" name="job_application[phone]" type="tel">
  <label for="location">Location (City)</label><input id="location" name="job_application[location]" type="text">
  <label for="resume">Resume/CV *</label><input id="resume" name="job_application[resume]" type="file">
  <label for="linkedin">LinkedIn Profile</label><input id="linkedin" name="job_application[answers_attributes][0][text_value]" type="text">
  <label for="auth">Are you legally authorized to work in the United States? *</label>
  <select id="auth" name="job_application[answers_attributes][1][boolean_value]"><option value="">Select...</option><option value="1">Yes</option><option value="0">No</option></select>
  <label for="sponsor">Will you now or in the future require sponsorship for employment visa status? *</label>
  <select id="sponsor" name="job_application[answers_attributes][2][boolean_value]"><option value="">Select...</option><option value="1">Yes</option><option value="0">No</option></select>
  <label for="why">Why do you want to work at Stripe? *</label><textarea id="why" name="job_application[answers_attributes][3][text_value]"></textarea>
  <label for="prefilled">How did you hear about us?</label><input id="prefilled" name="job_application[answers_attributes][4][text_value]" type="text" value="Typed by the user">
  <fieldset><legend>Voluntary Self-Identification</legend>
    <label for="gender">Gender</label><select id="gender" name="job_application[gender]"><option value="">Please select</option><option>Male</option><option>Female</option><option>Decline to self-identify</option></select>
    <label for="race">Race / Ethnicity</label><select id="race" name="job_application[race]"><option value="">Please select</option><option>Decline to self-identify</option></select>
    <label for="veteran">Veteran Status</label><select id="veteran" name="job_application[veteran_status]"><option value="">Please select</option><option>I am not a protected veteran</option></select>
  </fieldset>
  <label><input id="consent" type="checkbox" name="job_application[data_compliance][gdpr_consent_given]"> I consent to the processing of my data</label>
  <button type="submit" id="submit_app">Submit Application</button>
</form></div></body></html>
`,
);

console.log("Wrote fixtures to", out);
