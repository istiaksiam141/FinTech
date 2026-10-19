(function () {
  "use strict";
  const { Finance, loadPlan, money } = window.CampusBridgePageUtils;
  const Renderer = window.CampusBridgeAssistantRenderer;
  const Conversation = window.CampusBridgeAssistantConversation;
  const form = document.getElementById("assistant-form");
  const question = document.getElementById("assistant-question");
  const answer = document.getElementById("assistant-answer");
  const status = document.getElementById("assistant-status");
  const submit = form.querySelector('button[type="submit"]');
  let pending = false;

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (pending) return;
    const text = question.value.trim();
    if (!text || text.length > 1000) {
      status.textContent = "Enter a question of 1,000 characters or fewer.";
      question.focus();
      return;
    }

    pending = true;
    submit.disabled = true;
    question.disabled = true;
    answer.setAttribute("aria-busy", "true");
    status.textContent = "Preparing your answer…";
    const turn = Conversation.createTurn(answer, text);
    turn.response.textContent = "Preparing your answer…";
    Conversation.scrollToLatest(turn.element);

    try {
      const plan = loadPlan();
      if (plan.ok && /funding gap|how much.*save|monthly target|can i afford/.test(text.toLowerCase())) {
        const target = Finance.describeMonthlySavingsTarget(plan.result);
        const targetText = target.state === "covered" ? target.message : target.state === "unavailable" ? target.message : `The adjusted contribution schedule is ${money(target.regularAmount)} for each regular cycle, then ${money(target.finalAmount)} in the final cycle.`;
        Renderer.render(turn.response, `Based on your saved plan, the estimated funding gap is ${money(plan.result.gap)}. ${targetText} The projection assumes your entered monthly surplus continues; it is not a guarantee.`);
        status.textContent = "Answered locally from the deterministic planner. No plan details were sent to the AI service.";
        return;
      }

      status.textContent = "Sending only your question to CampusBridge AI…";
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ question: text })
      });
      let payload = {};
      try { payload = await response.json(); } catch { /* handled below */ }
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "The assistant is temporarily unavailable.");
      if (typeof payload.answer !== "string" || !payload.answer.trim()) throw new Error("The assistant returned no usable answer.");
      Renderer.render(turn.response, payload.answer);
      if (payload.incomplete === true) {
        const warning = document.createElement("p");
        warning.className = "answerNotice";
        warning.textContent = "This answer may be incomplete because it reached a response limit. Ask a narrower question.";
        turn.response.append(warning);
      }
      status.textContent = "General educational information only. Your saved plan and quotes were not sent.";
    } catch (error) {
      const message = error.message || "The assistant is temporarily unavailable.";
      turn.response.textContent = `Assistant unavailable: ${message}`;
      status.textContent = message;
    } finally {
      pending = false;
      submit.disabled = false;
      question.disabled = false;
      answer.setAttribute("aria-busy", "false");
      Conversation.scrollToLatest(turn.element, { onlyIfVisible: true });
    }
  });
})();
