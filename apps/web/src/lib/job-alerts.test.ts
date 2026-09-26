import { describe, expect, it } from "vitest";
import { alertAliasFrom, classifyInbound, parseForwardingConfirmation, parseLinkedInAlert } from "./job-alerts";

// Shaped like LinkedIn job-alert emails (fictional jobs).
const html = `
<table><tr><td>
  <a href="https://www.linkedin.com/comm/jobs/view/4011111111/?trackingId=abc&amp;refId=x"><img src="logo.png" alt=""></a>
  <a href="https://www.linkedin.com/comm/jobs/view/4011111111/?trackingId=abc&amp;refId=x" style="color:#0a66c2">Senior Product Designer</a>
  <p>Stripe · San Francisco, CA (Remote)</p>
  <p>Actively recruiting</p>
</td></tr><tr><td>
  <a href="https://www.linkedin.com/comm/jobs/view/4022222222/?trackingId=def">Product Designer, Growth</a>
  <p>Figma</p><p>New York, NY</p>
  <a href="https://www.linkedin.com/comm/jobs/view/4022222222/?trackingId=def">View job</a>
</td></tr></table>
<a href="https://www.linkedin.com/comm/jobs/search/?keywords=designer">See all jobs</a>`;

const text = `Your job alert for product designer
2 new jobs match your preferences.

Senior Product Designer
Stripe
San Francisco, CA (Remote)
View job: https://www.linkedin.com/comm/jobs/view/4011111111/?trackingId=abc

Product Designer, Growth
Figma
New York, NY
View job: https://www.linkedin.com/comm/jobs/view/4022222222/?trackingId=def

See all jobs: https://www.linkedin.com/comm/jobs/search/?keywords=designer`;

describe("parseLinkedInAlert", () => {
  const expected = [
    { externalId: "linkedin:4011111111", url: "https://www.linkedin.com/jobs/view/4011111111/", title: "Senior Product Designer", company: "Stripe", location: "San Francisco, CA (Remote)" },
    { externalId: "linkedin:4022222222", url: "https://www.linkedin.com/jobs/view/4022222222/", title: "Product Designer, Growth", company: "Figma", location: "New York, NY" },
  ];
  it("parses the HTML part", () => expect(parseLinkedInAlert({ html })).toEqual(expected));
  it("parses the plain-text part", () => expect(parseLinkedInAlert({ text })).toEqual(expected));
  it("combines both parts", () => expect(parseLinkedInAlert({ html, text })).toEqual(expected));
  it("returns nothing for unrelated emails", () => expect(parseLinkedInAlert({ text: "Hello, no jobs here." })).toEqual([]));
});

describe("inbound helpers", () => {
  it("classifies senders", () => {
    expect(classifyInbound("LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>", "Senior Product Designer at Stripe")).toBe("linkedin_alert");
    expect(classifyInbound("Gmail Team <forwarding-noreply@google.com>", "(#123456789) Gmail Forwarding Confirmation")).toBe("forwarding_confirmation");
    expect(classifyInbound("someone@example.com", "hi")).toBe("other");
  });
  it("extracts Gmail forwarding confirmation code and link", () => {
    const r = parseForwardingConfirmation(
      "(#123456789) Gmail Forwarding Confirmation - Receive Mail from me@gmail.com",
      "To allow forwarding, click: https://mail-settings.google.com/mail/vf-%5BABC%5D-123 \nConfirmation code: 123456789",
    );
    expect(r).toEqual({ code: "123456789", link: "https://mail-settings.google.com/mail/vf-%5BABC%5D-123" });
  });
  it("finds the alias among recipients", () => {
    expect(alertAliasFrom(["Me <me@gmail.com>", "2c754a8d65@alerts.offerwing.ai"], "alerts.offerwing.ai")).toBe("2c754a8d65");
    expect(alertAliasFrom(["2C754A8D65+tag@Alerts.Offerwing.ai"], "alerts.offerwing.ai")).toBe("2c754a8d65");
    expect(alertAliasFrom(["x@other.com"], "alerts.offerwing.ai")).toBeNull();
  });
});
