(function () {
  "use strict";
  const client = window.CampusBridgeSupabase?.client;
  const status = document.getElementById("account-status");
  if (!status) return;
  const logout = document.createElement("button"); logout.type = "button"; logout.id = "shared-logout"; logout.className = "button smallbtn"; logout.textContent = "Log out"; logout.hidden = true;
  status.insertAdjacentElement("afterend", logout);
  function show(user) {
    status.textContent = user?.email ? `Signed in: ${user.email}` : window.CampusBridgeSupabase?.configured ? "Not signed in" : "Cloud account setup needed";
    logout.hidden = !user;
  }
  if (!client) { show(null); return; }
  logout.addEventListener("click", async () => {
    logout.disabled = true;
    try {
      const { error } = await client.auth.signOut();
      if (error) status.textContent = "Could not sign out. Please try again.";
    } catch { status.textContent = "Could not sign out because the connection failed."; }
    finally { logout.disabled = false; }
  });
  client.auth.onAuthStateChange((_event, session) => show(session?.user || null));
  client.auth.getSession().then(({ data, error }) => show(error ? null : data?.session?.user || null)).catch(() => show(null));
})();
