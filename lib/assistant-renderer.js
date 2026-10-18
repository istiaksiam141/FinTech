(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampusBridgeAssistantRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function appendInline(parent, text, doc) {
    const pattern = /(\*\*[^*\s](?:[^*\n]*?[^*\s])?\*\*|(?<!\*)\*[^*\s](?:[^*\n]*?[^*\s])?\*(?!\*)|(?<![\w])__[^_\s](?:[^_\n]*?[^_\s])?__(?![\w])|(?<![\w])_[^_\s](?:[^_\n]*?[^_\s])?_(?![\w])|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
    let offset = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index > offset) parent.appendChild(doc.createTextNode(text.slice(offset, match.index)));
      const token = match[0];
      let element;
      if (token.startsWith("**") || token.startsWith("__")) { element = doc.createElement("strong"); element.textContent = token.slice(2, -2); }
      else if (token.startsWith("*") || token.startsWith("_")) { element = doc.createElement("em"); element.textContent = token.slice(1, -1); }
      else if (token.startsWith("`")) { element = doc.createElement("code"); element.textContent = token.slice(1, -1); }
      else {
        const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(token);
        try {
          const url = new URL(link[2]);
          if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported link protocol");
          element = doc.createElement("a"); element.textContent = link[1]; element.setAttribute("href", url.href); element.setAttribute("target", "_blank"); element.setAttribute("rel", "noopener noreferrer");
        } catch {
          parent.appendChild(doc.createTextNode(token));
        }
      }
      if (element) parent.appendChild(element);
      offset = match.index + token.length;
    }
    if (offset < text.length) parent.appendChild(doc.createTextNode(text.slice(offset)));
  }

  function splitTableRow(line) {
    const row = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    const cells = [];
    let cell = "", escaped = false;
    for (const character of row) {
      if (character === "|" && !escaped) { cells.push(cell.trim()); cell = ""; }
      else { cell += character; if (character === "\\" && !escaped) escaped = true; else escaped = false; }
    }
    cells.push(cell.trim());
    return cells;
  }

  function isTableDivider(line) {
    const cells = splitTableRow(line);
    return cells.length > 1 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
  }

  function appendTable(container, sourceRows, doc) {
    const table = doc.createElement("table");
    const thead = doc.createElement("thead"), headerRow = doc.createElement("tr");
    for (const value of sourceRows[0]) {
      const cell = doc.createElement("th"); cell.setAttribute("scope", "col"); appendInline(cell, value, doc); headerRow.appendChild(cell);
    }
    thead.appendChild(headerRow); table.appendChild(thead);
    const tbody = doc.createElement("tbody");
    for (const row of sourceRows.slice(1)) {
      const tr = doc.createElement("tr");
      for (let index = 0; index < sourceRows[0].length; index += 1) {
        const cell = doc.createElement("td"); appendInline(cell, row[index] || "", doc); tr.appendChild(cell);
      }
      tbody.appendChild(tr);
    }
    if (tbody.children?.length || sourceRows.length > 1) table.appendChild(tbody);
    container.appendChild(table);
  }

  function render(container, markdown, doc = container.ownerDocument || document) {
    while (container.firstChild) container.removeChild(container.firstChild);
    const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
    let paragraph = [], list = null, listType = null;
    const flushParagraph = () => {
      if (!paragraph.length) return;
      const node = doc.createElement("p"); appendInline(node, paragraph.join(" "), doc); container.appendChild(node); paragraph = [];
    };
    const closeList = () => { list = null; listType = null; };
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
      const bullet = /^\s*[-*+]\s+(.+)$/.exec(line);
      const numbered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
      if (index + 1 < lines.length && line.includes("|") && isTableDivider(lines[index + 1])) {
        flushParagraph(); closeList();
        const rows = [splitTableRow(line)]; index += 1;
        while (index + 1 < lines.length && lines[index + 1].includes("|") && lines[index + 1].trim()) {
          index += 1;
          if (!isTableDivider(lines[index])) rows.push(splitTableRow(lines[index]));
        }
        appendTable(container, rows, doc); continue;
      }
      if (!line.trim()) { flushParagraph(); closeList(); continue; }
      if (/^\s*(?:\|\s*)?(?::?-{3,}:?\s*\|\s*)+:?-{3,}:?\s*\|?\s*$/.test(line) || /^\s*#{1,6}\s*$/.test(line)) { flushParagraph(); closeList(); continue; }
      if (/^\s*[-*_]{3,}\s*$/.test(line)) { flushParagraph(); closeList(); continue; }
      if (heading) {
        flushParagraph(); closeList();
        const node = doc.createElement(`h${Math.min(heading[1].length + 2, 6)}`); appendInline(node, heading[2], doc); container.appendChild(node); continue;
      }
      if (/^\s*```/.test(line)) {
        flushParagraph(); closeList();
        const codeLines = [];
        while (index + 1 < lines.length && !/^\s*```/.test(lines[index + 1])) codeLines.push(lines[++index]);
        if (index + 1 < lines.length) index += 1;
        const pre = doc.createElement("pre"), code = doc.createElement("code"); code.textContent = codeLines.join("\n"); pre.appendChild(code); container.appendChild(pre); continue;
      }
      const quote = /^\s*>\s?(.*)$/.exec(line);
      if (quote) { flushParagraph(); closeList(); const node = doc.createElement("blockquote"); const p = doc.createElement("p"); appendInline(p, quote[1], doc); node.appendChild(p); container.appendChild(node); continue; }
      if (bullet || numbered) {
        flushParagraph();
        const type = bullet ? "ul" : "ol";
        if (!list || listType !== type) { closeList(); list = doc.createElement(type); listType = type; container.appendChild(list); }
        const item = doc.createElement("li"); appendInline(item, (bullet || numbered)[1], doc); list.appendChild(item); continue;
      }
      closeList(); paragraph.push(line.trim());
    }
    flushParagraph();
  }

  return Object.freeze({ render });
});
