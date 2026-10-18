(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampusBridgeAssistantRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function appendInline(parent, text, doc) {
    const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
    let offset = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index > offset) parent.appendChild(doc.createTextNode(text.slice(offset, match.index)));
      const token = match[0];
      let element;
      if (token.startsWith("**")) { element = doc.createElement("strong"); element.textContent = token.slice(2, -2); }
      else if (token.startsWith("*")) { element = doc.createElement("em"); element.textContent = token.slice(1, -1); }
      else if (token.startsWith("`")) { element = doc.createElement("code"); element.textContent = token.slice(1, -1); }
      else {
        const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(token);
        try {
          const url = new URL(link[2]);
          if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("unsupported protocol");
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

  function render(container, markdown, doc = container.ownerDocument || document) {
    while (container.firstChild) container.removeChild(container.firstChild);
    const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
    let paragraph = [], list = null, listType = null;
    const flushParagraph = () => {
      if (!paragraph.length) return;
      const node = doc.createElement("p"); appendInline(node, paragraph.join(" "), doc); container.appendChild(node); paragraph = [];
    };
    const closeList = () => { list = null; listType = null; };
    for (const line of lines) {
      const heading = /^(#{1,3})\s+(.+)$/.exec(line);
      const bullet = /^\s*[-*+]\s+(.+)$/.exec(line);
      const numbered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
      if (!line.trim()) { flushParagraph(); closeList(); continue; }
      if (heading) {
        flushParagraph(); closeList();
        const node = doc.createElement(`h${heading[1].length + 2}`); appendInline(node, heading[2], doc); container.appendChild(node); continue;
      }
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
