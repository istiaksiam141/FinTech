(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampusBridgeMfaFlow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VALID_AAL = new Set(["aal1", "aal2"]);
  const SAFE_ASSURANCE_ERROR = "Supabase returned an unknown sign-in assurance level. Refresh your session before using cloud features.";

  function createMfaFlow({ client } = {}) {
    const mfa = client?.auth?.mfa;
    const challenges = new Map();
    let enrollment = null;

    function available() {
      return Boolean(mfa?.getAuthenticatorAssuranceLevel && mfa?.listFactors && mfa?.challenge && mfa?.verify && mfa?.enroll && mfa?.unenroll);
    }
    function key(purpose, factorId) { return `${purpose}:${factorId}`; }
    function clearChallenge(purpose, factorId) {
      if (purpose && factorId) challenges.delete(key(purpose, factorId));
      else if (purpose) {
        for (const [entry, value] of challenges) {
          if (entry.startsWith(`${purpose}:`)) { value.cancelled = true; challenges.delete(entry); }
        }
      } else {
        for (const value of challenges.values()) value.cancelled = true;
        challenges.clear();
      }
    }
    function clearEnrollment() { enrollment = null; clearChallenge("enrollment"); }
    function assuranceIsValid(value) {
      return Boolean(value && typeof value === "object" && VALID_AAL.has(value.currentLevel) && VALID_AAL.has(value.nextLevel));
    }

    async function inspect(session) {
      if (!session?.user) { clearChallenge(); clearEnrollment(); return { status: "signed-out" }; }
      if (!available()) return { status: "error", error: "This Supabase client cannot check MFA assurance. Refresh the page before using cloud features." };
      try {
        const [{ data: assurance, error: assuranceError }, { data: factors, error: factorsError }] = await Promise.all([
          mfa.getAuthenticatorAssuranceLevel(), mfa.listFactors()
        ]);
        if (assuranceError || factorsError) throw assuranceError || factorsError;
        if (!assurance || typeof assurance !== "object") return { status: "error", error: SAFE_ASSURANCE_ERROR };
        if (!assuranceIsValid(assurance)) return { status: "error", error: SAFE_ASSURANCE_ERROR };
        const verifiedTotp = (factors?.totp || []).filter(factor => factor.status === "verified");
        const needsSecondFactor = assurance.currentLevel === "aal1" && (assurance.nextLevel === "aal2" || verifiedTotp.length > 0);
        if (needsSecondFactor) {
          if (!verifiedTotp.length) return { status: "unsupported-factor", error: "This account requires a second factor that this page cannot verify. Contact support." };
          const factor = verifiedTotp[0];
          const pending = challenges.get(key("login", factor.id));
          return { status: "challenge-required", factor, assurance, challengeId: pending?.id || null };
        }
        return { status: "ready", assurance, factors: factors?.totp || [] };
      } catch {
        return { status: "error", error: "Could not verify your authenticator status. Cloud features are paused until this can be checked." };
      }
    }

    async function startChallenge(factorId, { reuse = false, purpose = "login" } = {}) {
      if (!available() || !factorId) throw new Error("Authenticator verification is unavailable. Refresh and try again.");
      const challengeKey = key(purpose, factorId), current = challenges.get(challengeKey);
      if (current?.promise) return current.promise;
      if (reuse && current?.id) return current.id;
      const record = { factorId, purpose, promise: null, cancelled: false };
      const promise = (async () => {
        const { data, error } = await mfa.challenge({ factorId });
        if (error || !data?.id) {
          if (challenges.get(challengeKey) === record) challenges.delete(challengeKey);
          throw error || new Error("Could not start authenticator verification.");
        }
        if (record.cancelled || challenges.get(challengeKey) !== record) throw new Error("This verification request is no longer active. Start a new challenge.");
        record.id = data.id;
        record.promise = null;
        return data.id;
      })();
      record.promise = promise;
      challenges.set(challengeKey, record);
      try { return await promise; }
      catch (error) { if (challenges.get(challengeKey) === record) challenges.delete(challengeKey); throw error; }
    }

    async function verifyCode(code, { factorId, challengeId, purpose = "login" } = {}) {
      if (!/^\d{6}$/.test(String(code || ""))) throw new Error("Enter the six-digit code from your authenticator app.");
      if (!factorId && purpose === "login") factorId = [...challenges.values()].find(item => item.purpose === "login")?.factorId;
      const challengeKey = key(purpose, factorId), target = challenges.get(challengeKey);
      if (!factorId || !target?.id || (challengeId && target.id !== challengeId)) throw new Error("This verification challenge expired. Start a new one and try again.");
      const id = target.id;
      const { error } = await mfa.verify({ factorId, challengeId: id, code: String(code) });
      if (error) throw new Error("That code is incorrect or expired. Request a fresh challenge and try again.");
      if (purpose === "login" || purpose === "enrollment") clearChallenge(purpose, factorId);
      return true;
    }

    async function beginEnrollment() {
      if (!available()) throw new Error("Authenticator setup is unavailable. Refresh the page and try again.");
      const { data, error } = await mfa.enroll({ factorType: "totp", friendlyName: "CampusBridge AI" });
      if (error || !data?.id || typeof data?.totp?.qr_code !== "string" || !/^data:image\/svg\+xml(?:;|,)/i.test(data.totp.qr_code)) {
        throw error || new Error("Could not create a supported authenticator setup QR code.");
      }
      enrollment = { factorId: data.id };
      let challengeId;
      try { challengeId = await startChallenge(data.id, { purpose: "enrollment" }); }
      catch (startError) {
        const { error: cleanupError } = await mfa.unenroll({ factorId: data.id });
        clearEnrollment();
        if (cleanupError) throw new Error("Could not start setup or remove its incomplete factor. Refresh the account page before trying again.");
        throw startError;
      }
      return { factorId: data.id, challengeId, qrCode: data.totp.qr_code };
    }

    async function retryEnrollmentChallenge() {
      if (!enrollment?.factorId) throw new Error("Start authenticator setup again to continue.");
      return startChallenge(enrollment.factorId, { purpose: "enrollment" });
    }

    async function verifyEnrollment(code) {
      if (!enrollment) throw new Error("Start authenticator setup again to continue.");
      const factorId = enrollment.factorId;
      await verifyCode(code, { factorId, purpose: "enrollment" });
      const { data: assurance, error } = await mfa.getAuthenticatorAssuranceLevel();
      if (error || !assuranceIsValid(assurance) || assurance.currentLevel !== "aal2") throw new Error("The code was accepted, but Supabase has not confirmed AAL2 yet. Refresh the account page and check your authenticator status.");
      clearEnrollment();
      return true;
    }

    async function cancelEnrollment() {
      if (!enrollment) return;
      const factorId = enrollment.factorId;
      const { error } = await mfa.unenroll({ factorId });
      if (error) throw new Error("The unverified authenticator setup could not be removed. Try again.");
      clearEnrollment();
    }

    async function cancelDisable(factorId) { clearChallenge("disable", factorId); }

    async function disable(factorId, code) {
      if (!factorId) throw new Error("No verified authenticator was found.");
      await verifyCode(code, { factorId, purpose: "disable" });
      const { data: assurance, error: assuranceError } = await mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || !assuranceIsValid(assurance) || assurance.currentLevel !== "aal2") throw new Error("Verify your authenticator again before disabling it.");
      const { error } = await mfa.unenroll({ factorId });
      if (error) throw new Error("The authenticator could not be disabled. Verify your code and try again.");
      clearChallenge("disable", factorId);
      return true;
    }

    return Object.freeze({ available, inspect, startChallenge, verifyCode, beginEnrollment, retryEnrollmentChallenge, verifyEnrollment, cancelEnrollment, cancelDisable, disable });
  }

  return Object.freeze({ createMfaFlow });
});
