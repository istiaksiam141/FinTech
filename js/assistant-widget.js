(function () {
  "use strict";

  const panel = document.getElementById("assistant-widget-panel");
  const launcher = document.querySelector(".assistantWidgetLauncher");
  const closeButton = document.querySelector("[data-assistant-widget-close]");
  const newButton = document.querySelector("[data-assistant-widget-new]");
  const form = document.querySelector("[data-assistant-widget-form]");
  const question = document.getElementById("assistant-widget-question");
  const messages = document.querySelector("[data-assistant-widget-messages]");
  const status = document.querySelector("[data-assistant-widget-status]");
  if (!panel || !launcher || !form || !question || !messages || !status) return;

  let pending = false;
  let dependencies = null;

  function loadScript(source, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source;
      script.async = false;
      script.addEventListener("load", () => ready() ? resolve() : reject(new Error(`Could not initialize ${source}.`)), { once: true });
      script.addEventListener("error", () => reject(new Error(`Could not load ${source}.`)), { once: true });
      document.head.append(script);
    });
  }

  function prepareDependencies() {
    if (!dependencies) {
      dependencies = loadScript("/lib/finance.js", () => Boolean(window.CampusBridgeFinance))
        .then(() => loadScript("/lib/plan-state.js", () => Boolean(window.CampusBridgePlanState)))
        .then(() => loadScript("/lib/assistant-task.js", () => Boolean(window.CampusBridgeAssistantTask)))
        .then(() => loadScript("/js/page-utils.js", () => Boolean(window.CampusBridgePageUtils)))
        .then(() => loadScript("/lib/assistant-renderer.js", () => Boolean(window.CampusBridgeAssistantRenderer)))
        .catch(error => {
          dependencies = null;
          throw error;
        });
    }
    return dependencies;
  }

  function setOpen(open) {
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
    launcher.setAttribute("aria-label", `${open ? "Close" : "Open"} CampusBridge AI assistant`);
    if (open) {
      question.focus();
      void prepareDependencies().catch(error => {
        status.textContent = `${error.message} Please use the full assistant instead.`;
      });
    } else {
      launcher.focus();
    }
  }

  function appendMessage(text, kind) {
    const message = document.createElement("article");
    message.className = `assistantWidgetMessage ${kind === "user" ? "assistantWidgetMessageUser" : "assistantWidgetMessageBot"}`;
    const copy = document.createElement("div");
    copy.className = "assistantWidgetMessageCopy";
    if (kind === "user") copy.textContent = text;
    message.append(copy);
    messages.append(message);
    messages.scrollTop = messages.scrollHeight;
    return copy;
  }

  function renderAnswer(container, text) {
    window.CampusBridgeAssistantRenderer.render(container, text);
    messages.scrollTop = messages.scrollHeight;
  }

  launcher.addEventListener("click", () => setOpen(panel.hidden));
  closeButton?.addEventListener("click", () => setOpen(false));
  newButton?.addEventListener("click", () => {
    const greeting = document.createElement("article");
    greeting.className = "assistantWidgetMessage assistantWidgetMessageBot";
    greeting.innerHTML = '<div class="assistantWidgetMessageCopy"><p>Hi, I’m CampusBridge AI. Ask me a general study-abroad planning question.</p></div><span class="assistantWidgetMessageMeta">Saved plan inputs stay on-device</span>';
    messages.replaceChildren(greeting);
    status.textContent = "New chat. Questions are answered independently.";
    question.focus();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      setOpen(false);
    }
  });

  question.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

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
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    question.disabled = true;
    status.textContent = "Preparing your answer…";
    appendMessage(text, "user");
    question.value = "";
    const reply = appendMessage("Preparing your answer…", "assistant");

    try {
      await prepareDependencies();
      const task = window.CampusBridgeAssistantTask.run({
        question: text,
        Finance: window.CampusBridgeFinance,
        plan: window.CampusBridgePageUtils.loadPlan(),
        money: window.CampusBridgePageUtils.money
      });
      if (task.handled) {
        renderAnswer(reply, task.answer);
        status.textContent = "Answered locally. Your plan and quotes were not sent.";
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
      renderAnswer(reply, payload.answer);
      if (payload.incomplete === true) {
        const warning = document.createElement("p");
        warning.className = "assistantWidgetWarning";
        warning.textContent = "This answer may be incomplete. Ask a narrower question.";
        reply.append(warning);
      }
      status.textContent = "General educational information only. Your plan and quotes were not sent.";
    } catch (error) {
      reply.textContent = `I couldn’t prepare an answer: ${error.message || "The assistant is temporarily unavailable."}`;
      status.textContent = error.message || "The assistant is temporarily unavailable.";
    } finally {
      pending = false;
      submit.disabled = false;
      question.disabled = false;
      messages.scrollTop = messages.scrollHeight;
      question.focus();
    }
  });
})();
