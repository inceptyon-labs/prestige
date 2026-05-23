import DOMPurify, { type Config as DOMPurifyConfig } from "dompurify";

export const RICH_TEXT_HIGHLIGHT_ATTRIBUTE = "data-rich-text-highlight";
export const RICH_TEXT_HIGHLIGHT_COLOR_VAR = "--rich-text-highlight-color";
export const RICH_TEXT_HIGHLIGHT_SPREAD_VAR = "--rich-text-highlight-spread";
export const RICH_TEXT_HIGHLIGHT_RADIUS_VAR = "--rich-text-highlight-radius";

export const RICH_TEXT_HIGHLIGHT_SPREAD_EM = 0.05;
export const RICH_TEXT_HIGHLIGHT_RADIUS_EM = 0.12;
export const RICH_TEXT_HIGHLIGHT_TOP_OFFSET_EM = 0.08;
export const RICH_TEXT_HIGHLIGHT_HEIGHT_EM = 0.84;

const HIGHLIGHT_ELEMENT_SELECTOR = [
  "mark",
  "span",
  "font",
  `[${RICH_TEXT_HIGHLIGHT_ATTRIBUTE}]`,
].join(", ");

const getHighlightColor = (element: HTMLElement): string | null => {
  const backgroundColor = element.style.backgroundColor.trim();
  if (backgroundColor) {
    return backgroundColor;
  }

  if (element.tagName.toLowerCase() === "mark") {
    return "yellow";
  }

  return null;
};

const clearHighlightStyles = (element: HTMLElement) => {
  element.removeAttribute(RICH_TEXT_HIGHLIGHT_ATTRIBUTE);
  element.style.removeProperty(RICH_TEXT_HIGHLIGHT_COLOR_VAR);
  element.style.removeProperty(RICH_TEXT_HIGHLIGHT_SPREAD_VAR);
  element.style.removeProperty(RICH_TEXT_HIGHLIGHT_RADIUS_VAR);
};

export const normalizeRichTextHighlightRoot = (root: ParentNode): boolean => {
  let changed = false;

  for (const element of Array.from(
    root.querySelectorAll<HTMLElement>(HIGHLIGHT_ELEMENT_SELECTOR),
  )) {
    const backgroundColor = getHighlightColor(element);

    if (!backgroundColor) {
      if (
        element.hasAttribute(RICH_TEXT_HIGHLIGHT_ATTRIBUTE) ||
        element.style.getPropertyValue(RICH_TEXT_HIGHLIGHT_COLOR_VAR) ||
        element.style.getPropertyValue(RICH_TEXT_HIGHLIGHT_SPREAD_VAR) ||
        element.style.getPropertyValue(RICH_TEXT_HIGHLIGHT_RADIUS_VAR)
      ) {
        clearHighlightStyles(element);
        changed = true;
      }
      continue;
    }

    if (element.style.backgroundColor !== backgroundColor) {
      element.style.backgroundColor = backgroundColor;
      changed = true;
    }

    if (element.getAttribute(RICH_TEXT_HIGHLIGHT_ATTRIBUTE) !== "true") {
      element.setAttribute(RICH_TEXT_HIGHLIGHT_ATTRIBUTE, "true");
      changed = true;
    }

    if (
      element.style.getPropertyValue(RICH_TEXT_HIGHLIGHT_COLOR_VAR).trim() !==
      backgroundColor
    ) {
      element.style.setProperty(RICH_TEXT_HIGHLIGHT_COLOR_VAR, backgroundColor);
      changed = true;
    }

    const spreadValue = `${RICH_TEXT_HIGHLIGHT_SPREAD_EM}em`;
    if (
      element.style.getPropertyValue(RICH_TEXT_HIGHLIGHT_SPREAD_VAR).trim() !==
      spreadValue
    ) {
      element.style.setProperty(RICH_TEXT_HIGHLIGHT_SPREAD_VAR, spreadValue);
      changed = true;
    }

    const radiusValue = `${RICH_TEXT_HIGHLIGHT_RADIUS_EM}em`;
    if (
      element.style.getPropertyValue(RICH_TEXT_HIGHLIGHT_RADIUS_VAR).trim() !==
      radiusValue
    ) {
      element.style.setProperty(RICH_TEXT_HIGHLIGHT_RADIUS_VAR, radiusValue);
      changed = true;
    }
  }

  return changed;
};

const SANITIZE_CONFIG: DOMPurifyConfig = {
  ALLOWED_TAGS: [
    "b",
    "i",
    "u",
    "s",
    "strong",
    "em",
    "mark",
    "span",
    "font",
    "br",
    "div",
    "p",
  ],
  ALLOWED_ATTR: ["style", "class", "color", RICH_TEXT_HIGHLIGHT_ATTRIBUTE],
};

export const sanitizeRichTextHtml = (html: string): string =>
  DOMPurify.sanitize(html, SANITIZE_CONFIG);

export const normalizeRichTextHighlights = (html: string): string => {
  if (!html) {
    return html;
  }

  const sanitized = sanitizeRichTextHtml(html);
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${sanitized}</div>`, "text/html");
  const root = doc.body.firstElementChild;

  if (!root) {
    return sanitized;
  }

  normalizeRichTextHighlightRoot(root);
  return root.innerHTML;
};
