(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampusBridgeAssistantConversation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createTurn(container, question) {
    const document = container.ownerDocument || globalThis.document;
    if (container.dataset.conversationStarted !== "true") {
      container.replaceChildren();
      container.dataset.conversationStarted = "true";
    }

    const turn = document.createElement("article");
    turn.className = "assistantTurn";
    const prompt = document.createElement("p");
    prompt.className = "assistantTurnQuestion";
    const userLabel = document.createElement("strong");
    userLabel.textContent = "You";
    const questionText = document.createElement("span");
    questionText.textContent = question;
    prompt.append(userLabel, questionText);

    const reply = document.createElement("section");
    reply.className = "assistantTurnReply";
    const assistantLabel = document.createElement("strong");
    assistantLabel.className = "assistantTurnLabel";
    assistantLabel.textContent = "CampusBridge AI";
    const response = document.createElement("div");
    response.className = "assistantTurnResponse";
    reply.append(assistantLabel, response);
    turn.append(prompt, reply);
    container.appendChild(turn);
    return { element: turn, response };
  }

  function scrollToLatest(element, { onlyIfVisible = false } = {}) {
    if (typeof element?.scrollIntoView !== "function") return;
    if (onlyIfVisible) {
      const rect = element.getBoundingClientRect?.();
      const viewportHeight = Number(globalThis.innerHeight) || 0;
      if (!rect || rect.bottom <= 0 || rect.top >= viewportHeight) return;
    }
    const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
  }

  return Object.freeze({ createTurn, scrollToLatest });
});
