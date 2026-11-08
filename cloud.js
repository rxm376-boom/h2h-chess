/* H2H Chess on the open web: real login + synced stats through Supabase (free tier).
   The game itself is unchanged. It already knows how to save to an account through
   window.claude.use("user") and window.claude.use("db"); this file provides those two
   backed by Supabase, and folds email login into the game's own Sign in button. With no keys in config.js it does nothing
   and the game keeps stats in the browser. */
(function () {
  "use strict";
  var cfg = window.H2H_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey || window.claude) return;

  var SDK = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.89.0/dist/umd/supabase.min.js";
  var clientP = new Promise(function (resolve) {
    var s = document.createElement("script");
    s.src = SDK;
    s.onload = function () {
      try { resolve(window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, detectSessionInUrl: true, flowType: "implicit" } })); }
      catch (e) { console.warn("Supabase init failed", e); resolve(null); }
    };
    s.onerror = function () { console.warn("Supabase SDK failed to load"); resolve(null); };
    document.head.appendChild(s);
  });
  var sessionP = clientP.then(function (sb) {
    if (!sb) return null;
    return sb.auth.getSession().then(function (r) { return r.data && r.data.session; }).catch(function () { return null; });
  });

  function userApi() {
    return sessionP.then(function (s) {
      if (!s) return null;
      return { id: function () { return Promise.resolve(s.user.id); }, email: s.user.email };
    });
  }
  function dbApi() {
    return Promise.all([clientP, sessionP]).then(function (a) {
      var sb = a[0], s = a[1];
      if (!sb || !s) return null;
      return {
        collection: function () {
          return {
            doc: function () {
              return {
                get: function () {
                  return sb.from("h2h_profiles").select("data").eq("user_id", s.user.id).maybeSingle().then(function (r) {
                    if (r.error) throw r.error;
                    return { exists: !!r.data, data: function () { return r.data ? r.data.data : null; } };
                  });
                },
                set: function (obj) {
                  return sb.from("h2h_profiles").upsert({ user_id: s.user.id, data: obj, updated_at: new Date().toISOString() }).then(function (r) {
                    if (r.error) throw r.error;
                  });
                }
              };
            }
          };
        }
      };
    });
  }
  window.claude = {
    use: function (name) {
      if (name === "user") return userApi();
      if (name === "db") return dbApi();
      return Promise.resolve(null);
    }
  };

  /* ---------- one sign-in: the game's own Player panel ----------
     Logged out of Supabase: "Sign in" opens a choice between an emailed link (stats sync
     everywhere) and playing as a guest on this device (the game's original name prompt).
     Back from the email link: the game's name prompt opens by itself, once.
     Sign out also ends the email session. */
  var css = ".h2hAlt{background:none;border:0;color:var(--muted,#a89ec4);font:inherit;font-size:13px;text-decoration:underline;cursor:pointer;padding:4px 0;align-self:center}" +
    ".h2hNote{font-size:13px!important;color:var(--muted,#a89ec4)!important}";
  function el(tag, attrs, text) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (text) e.textContent = text; return e; }
  function byId(id) { return document.getElementById(id); }
  var passThrough = false;

  function openEmailDialog(sb) {
    var wrap = el("div", { "class": "dlg", role: "dialog", "aria-modal": "true", "aria-labelledby": "h2hDlgT" });
    var box = el("form", { "class": "dlgBox" });
    box.appendChild(el("div", { "class": "dlgTitle", id: "h2hDlgT" }, "Sign in"));
    var txt = el("p", {}, (cfg.providers || []).length ? "Sign in so your rating and record follow you to any device." : "Enter your email and we'll send you a sign-in link. Your rating and record then follow you to any device.");
    box.appendChild(txt);
    // One-tap providers listed in config.js (e.g. providers: ["google"]); each must be enabled in Supabase.
    var NAMES = { google: "Google", github: "GitHub", apple: "Apple", discord: "Discord" };
    (cfg.providers || []).forEach(function (prov) {
      var b = el("button", { type: "button", "class": "btn" }, "Continue with " + (NAMES[prov] || prov));
      b.onclick = function () {
        try { localStorage.setItem("h2h.pendingName", "1"); } catch (err) {}
        sb.auth.signInWithOAuth({ provider: prov, options: { redirectTo: location.origin + location.pathname } });
      };
      box.appendChild(b);
    });
    if ((cfg.providers || []).length) box.appendChild(el("p", { "class": "h2hNote" }, "Or get a sign-in link by email:"));
    var inp = el("input", { type: "email", required: "", placeholder: "you@email.com", autocomplete: "email", "aria-label": "Email" });
    box.appendChild(inp);
    var btns = el("div", { "class": "riskBtns" });
    var no = el("button", { type: "button", "class": "btn ghost" }, "Cancel");
    var yes = el("button", { type: "submit", "class": "btn" }, "Email me a link");
    btns.appendChild(no); btns.appendChild(yes); box.appendChild(btns);
    var guest = el("button", { type: "button", "class": "h2hAlt" }, "Play as guest on this device instead");
    box.appendChild(guest);
    wrap.appendChild(box); document.body.appendChild(wrap);
    setTimeout(function () { inp.focus(); }, 0);
    function close() { wrap.remove(); document.removeEventListener("keydown", esc); }
    function esc(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", esc);
    no.onclick = close;
    wrap.addEventListener("click", function (e) { if (e.target === wrap) close(); });
    guest.onclick = function () { close(); passThrough = true; byId("signIn").click(); };
    box.onsubmit = function (e) {
      e.preventDefault();
      var email = inp.value.trim(); if (!email) return;
      yes.disabled = true; yes.textContent = "Sending...";
      sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.origin + location.pathname } }).then(function (r) {
        if (r.error) { txt.textContent = "Couldn't send the link: " + r.error.message; yes.disabled = false; yes.textContent = "Try again"; return; }
        try { localStorage.setItem("h2h.pendingName", "1"); } catch (err) {}
        box.innerHTML = "";
        box.appendChild(el("div", { "class": "dlgTitle" }, "Check your email"));
        box.appendChild(el("p", {}, "We sent a sign-in link to " + email + ". Open it on this device and you'll come straight back here, signed in."));
        var ok = el("div", { "class": "riskBtns" }); var b = el("button", { type: "button", "class": "btn" }, "OK"); b.onclick = close; ok.appendChild(b); box.appendChild(ok);
        b.focus();
      });
    };
  }

  function mount() {
    var st = el("style"); st.textContent = css; document.head.appendChild(st);
    var signIn = byId("signIn"), signOut = byId("signOut");
    if (!signIn) return;
    Promise.all([clientP, sessionP]).then(function (a) {
      var sb = a[0], s = a[1];
      if (!sb) return; // Supabase unreachable: the game's own guest sign-in stays as is
      var hint = document.querySelector("#acctOut .acct-hint");
      if (!s) {
        signIn.textContent = "Sign in";
        if (hint) hint.textContent = "Sign in to track your rating, wins, losses and streak on any device.";
        signIn.addEventListener("click", function (e) {
          if (passThrough) { passThrough = false; return; }
          e.stopImmediatePropagation(); e.preventDefault();
          openEmailDialog(sb);
        }, true);
        return;
      }
      // Signed in by email.
      var email = s.user.email || "your account";
      signIn.textContent = "Choose player name";
      if (hint) hint.textContent = "Signed in as " + email + ". Pick a player name to start tracking.";
      var where = byId("acctWhere");
      if (where) new MutationObserver(function () {
        var want = "Saved to " + email + ". Syncs on every device.";
        if (/account/.test(where.textContent) && where.textContent !== want) where.textContent = want;
      }).observe(where, { childList: true, characterData: true, subtree: true });
      if (signOut) signOut.addEventListener("click", function () {
        setTimeout(function () { sb.auth.signOut().then(function () { location.reload(); }); }, 600);
      });
      var pending = false; try { pending = !!localStorage.getItem("h2h.pendingName"); localStorage.removeItem("h2h.pendingName"); } catch (e) {}
      if (pending || /access_token|type=magiclink/.test(location.hash)) {
        var tries = 0;
        (function waitReady() {
          var g = window.__h2h;
          if (g && g.ACCT && g.ACCT.ready) { if (!g.ACCT.store.active) signIn.click(); return; }
          if (++tries < 60) setTimeout(waitReady, 250);
        })();
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
