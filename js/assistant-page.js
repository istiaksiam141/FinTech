(function () {
  "use strict";
  const { Finance, loadPlan, money } = window.CampusBridgePageUtils;
  const Renderer = window.CampusBridgeAssistantRenderer;
  const question = document.getElementById("assistant-question"), answer = document.getElementById("assistant-answer"), status = document.getElementById("assistant-status");
  document.getElementById("assistant-form").addEventListener("submit", async event => {
    event.preventDefault();
    const text = question.value.trim();
    if (!text || text.length > 1000) { status.textContent = "Enter a question of 1,000 characters or fewer."; return; }
    const plan = loadPlan();
    if (plan.ok && /funding gap|how much.*save|monthly target|can i afford/.test(text.toLowerCase())) {
      const target = Finance.describeMonthlySavingsTarget(plan.result);
      const targetText = target.state === "covered" ? target.message : target.state === "unavailable" ? target.message : `The adjusted contribution schedule is ${money(target.regularAmount)} for each regular cycle, then ${money(target.finalAmount)} in the final cycle.`;
      Renderer.render(answer, `Based on your saved plan, the estimated funding gap is ${money(plan.result.gap)}. ${targetText} The projection assumes your entered monthly surplus continues; it is not a guarantee.`);
      status.textContent = "Answered locally from the deterministic planner. No plan details were sent to the AI service.";
      return;
    }
    answer.textContent = ""; status.textContent = "Sending only your question to CampusBridge AI…";
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ question: text }) });
      let payload = {}; try { payload = await response.json(); } catch { /* handled below */ }
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "The assistant is temporarily unavailable.");
      if (typeof payload.answer !== "string" || !payload.answer.trim()) throw new Error("The assistant returned no usable answer.");
      Renderer.render(answer, payload.answer);
      if (payload.incomplete === true) { const warning = document.createElement("p"); warning.className = "answerNotice"; warning.textContent = "This answer may be incomplete because it reached a response limit. Ask a narrower question."; answer.append(warning); }
      status.textContent = "General educational information only. Your saved plan and quotes were not sent.";
    } catch (error) { status.textContent = error.message || "The assistant is temporarily unavailable."; }
  });
})();
