// Run inside an application-form page (and its frames) via chrome.scripting.executeScript, only when
// the user clicks. Both functions must be fully self-contained: Chrome serializes them.
// scanForm reads the form's fields; fillForm types the values the user approved. Neither ever
// submits the form or clicks anything outside the fields being filled.

import type { FieldKind } from "@/lib/autofill";

export type ScannedField = { ref: string; kind: FieldKind; label: string; hints: string; required: boolean; options: string[]; hasValue: boolean };
export type ScanResult = { fields: ScannedField[]; title: string };

export function scanForm(): ScanResult {
  const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
  const stripStar = (s: string) => s.replace(/\s*\*+\s*$/, "").replace(/\s*\(required\)\s*$/i, "").trim();
  const textWithout = (root: Element, skip: Element) => {
    let out = "";
    const walk = (n: Node) => {
      if (n === skip || (n instanceof Element && n.matches("select, option, input, textarea, button"))) return;
      if (n.nodeType === Node.TEXT_NODE) out += ` ${n.textContent}`;
      else n.childNodes.forEach(walk);
    };
    walk(root);
    return clean(out);
  };
  const visible = (el: HTMLElement) => !!(el.offsetParent || el.getClientRects().length) && getComputedStyle(el).visibility !== "hidden";

  const labelOf = (el: HTMLElement): string => {
    const by = el.getAttribute("aria-labelledby");
    if (by) {
      const t = clean(by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" "));
      if (t) return t;
    }
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) {
        const t = textWithout(l, el);
        if (t) return t;
      }
    }
    const wrap = el.closest("label");
    if (wrap) {
      const t = textWithout(wrap, el);
      if (t) return t;
    }
    const aria = clean(el.getAttribute("aria-label"));
    if (aria) return aria;
    // Nearby question text in the field's container.
    let node = el.parentElement;
    for (let i = 0; i < 4 && node; i++, node = node.parentElement) {
      // Stop before the container holds other fields, or we'd borrow their labels.
      if (node.querySelectorAll("input:not([type='hidden']), select, textarea").length > 1) break;
      const cand = [...node.querySelectorAll<HTMLElement>("label, legend, [class*='label' i], [class*='question' i], [class*='title' i]")].find(
        (c) => !c.contains(el) && clean(c.textContent).length > 1 && clean(c.textContent).length < 400,
      );
      if (cand) return clean(cand.textContent);
    }
    return clean(el.getAttribute("placeholder"));
  };

  const fields: ScannedField[] = [];
  let n = 0;
  const ref = () => `ow${Date.now().toString(36)}${n++}`;
  const hintsOf = (el: HTMLElement) => clean([el.getAttribute("name"), el.id, el.getAttribute("autocomplete"), el.getAttribute("placeholder")].filter(Boolean).join(" ")).toLowerCase();
  const isRequired = (el: HTMLElement, rawLabel: string) => (el as HTMLInputElement).required || el.getAttribute("aria-required") === "true" || /\*\s*$/.test(rawLabel);

  const seenRadioGroups = new Set<string>();
  const controls = [...document.querySelectorAll<HTMLElement>("input, textarea, select")];
  for (const el of controls) {
    if (el.closest("[data-offerwing-ignore]")) continue;
    const input = el as HTMLInputElement;
    const type = (el instanceof HTMLInputElement ? input.type : el.tagName.toLowerCase()).toLowerCase();
    if (["hidden", "submit", "button", "reset", "image", "password", "search"].includes(type)) continue;
    if (input.disabled || input.readOnly) continue;
    if (type !== "file" && !visible(el)) continue;

    if (type === "radio") {
      const name = input.name || input.closest("[role='radiogroup'], fieldset")?.id || "";
      const key = name || `solo-${n}`;
      if (seenRadioGroups.has(key)) continue;
      seenRadioGroups.add(key);
      const group = name ? [...document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]`)] : [input];
      const container = input.closest("fieldset, [role='radiogroup']");
      const legend = container?.querySelector("legend");
      const rawLabel = clean(legend?.textContent) || (container?.getAttribute("aria-labelledby") ? labelOf(container as HTMLElement) : "") || (() => {
        // Question text above the whole group.
        let node = group[0].parentElement;
        for (let i = 0; i < 5 && node; i++, node = node.parentElement) {
          if (!group.every((r) => node!.contains(r))) continue;
          const cand = [...node.querySelectorAll<HTMLElement>("label, legend, [class*='label' i], [class*='question' i]")].find(
            (c) => !group.some((r) => c.contains(r) || (r.id && c.getAttribute("for") === r.id)) && clean(c.textContent).length > 1,
          );
          if (cand) return clean(cand.textContent);
        }
        return "";
      })();
      const r = ref();
      const options: string[] = [];
      for (const radio of group) {
        const optLabel = labelOf(radio) || radio.value;
        radio.setAttribute("data-offerwing-ref", r);
        radio.setAttribute("data-offerwing-option", optLabel);
        options.push(optLabel);
      }
      fields.push({ ref: r, kind: "radio", label: stripStar(rawLabel), hints: hintsOf(input), required: group.some((g) => g.required) || /\*\s*$/.test(rawLabel), options, hasValue: group.some((g) => g.checked) });
      continue;
    }

    const rawLabel = labelOf(el);
    const r = ref();
    el.setAttribute("data-offerwing-ref", r);
    let kind: FieldKind;
    let options: string[] = [];
    let hasValue = false;
    if (el instanceof HTMLSelectElement) {
      kind = "select";
      options = [...el.options].map((o) => clean(o.textContent));
      hasValue = el.selectedIndex > 0 && !!el.value;
    } else if (el instanceof HTMLTextAreaElement) {
      kind = "textarea";
      hasValue = !!el.value.trim();
    } else if (el.getAttribute("role") === "combobox") {
      kind = "combobox";
      // Custom dropdowns (react-select) show their chosen value next to the input.
      const box = el.closest("[class*='container' i], [class*='select' i]");
      hasValue = !!input.value.trim() || !!box?.querySelector("[class*='single-value' i], [class*='singleValue' i]");
    } else {
      kind = (["email", "tel", "url", "number", "date", "checkbox", "file"].includes(type) ? type : "text") as FieldKind;
      hasValue = type === "checkbox" ? input.checked : type === "file" ? !!input.files?.length : !!input.value.trim();
    }
    fields.push({ ref: r, kind, label: stripStar(rawLabel), hints: hintsOf(el), required: isRequired(el, rawLabel), options, hasValue });
  }
  return { fields, title: document.title };
}

export type FillInput = { ref: string; kind: FieldKind; value: string; label: string };
export type FillResult = { filled: string[]; failed: string[] };

export async function fillForm(actions: FillInput[], resume: { name: string; type: string; base64: string } | null): Promise<FillResult> {
  const filled: string[] = [];
  const failed: string[] = [];
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const mark = (el: HTMLElement) => {
    el.style.outline = "2px solid #6242ff";
    el.style.outlineOffset = "2px";
  };
  const setValue = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  };

  for (const a of actions) {
    const els = [...document.querySelectorAll<HTMLElement>("[data-offerwing-ref]")].filter((e) => e.getAttribute("data-offerwing-ref") === a.ref);
    const el = els[0];
    if (!el) {
      failed.push(a.label);
      continue;
    }
    try {
      if (a.kind === "radio") {
        const radio = els.find((r) => norm(r.getAttribute("data-offerwing-option")) === norm(a.value)) as HTMLInputElement | undefined;
        if (!radio) throw new Error("option");
        if (!radio.checked) radio.click();
        mark(radio.closest("label") ?? radio);
      } else if (el instanceof HTMLSelectElement) {
        const opt = [...el.options].find((o) => norm(o.textContent) === norm(a.value)) ?? [...el.options].find((o) => norm(o.value) === norm(a.value));
        if (!opt) throw new Error("option");
        setValue(el, opt.value);
        mark(el);
      } else if (a.kind === "file") {
        if (!resume) throw new Error("no file");
        const bytes = Uint8Array.from(atob(resume.base64), (c) => c.charCodeAt(0));
        const dt = new DataTransfer();
        dt.items.add(new File([bytes], resume.name, { type: resume.type }));
        (el as HTMLInputElement).files = dt.files;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        mark((el.closest("[class*='upload' i], [class*='drop' i], label") as HTMLElement | null) ?? el);
      } else if (a.kind === "combobox") {
        const input = el as HTMLInputElement;
        input.focus();
        setValue(input, a.value);
        await sleep(450);
        const options = [...document.querySelectorAll<HTMLElement>("[role='option']")].filter((o) => o.getClientRects().length);
        const pick = options.find((o) => norm(o.textContent) === norm(a.value)) ?? options.find((o) => norm(o.textContent).startsWith(norm(a.value)));
        if (!pick) {
          setValue(input, "");
          throw new Error("option");
        }
        pick.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        pick.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        pick.click();
        mark((input.closest("[class*='container' i]") as HTMLElement | null) ?? input);
      } else {
        const input = el as HTMLInputElement | HTMLTextAreaElement;
        input.focus();
        setValue(input, a.value);
        mark(input);
      }
      filled.push(a.label);
    } catch {
      failed.push(a.label);
    }
  }
  return { filled, failed };
}
