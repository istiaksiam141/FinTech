# Assistant behavior

The assistant is deterministic browser-side logic, not an external LLM. It uses the current student-entered profile with the same tuition calculator and can summarize eligible, manually entered provider quotes. When the tuition funding gap is zero, it says that the student's current usable savings cover the estimated tuition need and no additional monthly savings are needed for that target. Quote validation checks fields, currency, and the documented 24-hour freshness window; it does not authenticate a provider quote. The assistant cannot retrieve live facts, verify a provider or quote, access accounts, or execute a transfer.

Supported actions are tuition-gap calculation, budget summary, entered-quote comparison, and local educational guidance. Intent matching does not add tools or permissions. The in-memory activity log records the function name, local timestamp, status, and short result summary; it omits the raw question and profile inputs.

If a model is added in the future, it must run through an approved backend, use schema-validated allowlisted calculations, validate financial claims against tool results, keep credentials server-side, limit data exposure, and retain this deterministic fallback. Do not provide a payment execution tool.
