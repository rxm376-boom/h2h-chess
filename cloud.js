/* H2H Chess on the open web: real login + synced stats through Supabase (free tier).
   The game itself is unchanged. It already knows how to save to an account through
   window.claude.use("user") and window.claude.use("db"); this file provides those two
   backed by Supabase, and folds username/password and GitHub login into the game's own Sign in button. With no keys in config.js it does nothing
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
     Logged out: "Sign in" opens a dialog with GitHub, username + password (sign in or create
     account), and "play as guest on this device" (the game's original name prompt).
     Usernames are stored in Supabase as <username>@USER_DOMAIN; no email is ever sent,
     so "Confirm email" must be OFF in Supabase. After sign-in the game profile is created
     automatically with the username. Sign out also ends the Supabase session. */
  var USER_DOMAIN = "players.h2h-chess.rxm376-boom.github.io";
  var css = ".h2hAlt{background:none;border:0;color:var(--muted,#a89ec4);font:inherit;font-size:13px;text-decoration:underline;cursor:pointer;padding:4px 0;align-self:center}" +
    ".h2hOr{display:flex;align-items:center;gap:10px;color:var(--muted,#a89ec4);font-size:12px;letter-spacing:.08em;text-transform:uppercase}" +
    ".h2hOr:before,.h2hOr:after{content:'';flex:1;height:1px;background:var(--line,#3d3468)}" +
    ".h2hErr{color:#ff8f86!important;font-size:13px!important}" +
    ".h2hGh{display:flex;align-items:center;justify-content:center;gap:8px;background:#f1e9d6!important}" +
    ".h2hGh svg{width:18px;height:18px}";
  var GH_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
  function el(tag, attrs, text) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (text) e.textContent = text; return e; }
  function byId(id) { return document.getElementById(id); }
  function displayName(user) {
    var m = user.user_metadata || {};
    if (m.username) return m.username;
    if (m.user_name) return m.user_name;           // GitHub login
    if (m.preferred_username) return m.preferred_username;
    var e = user.email || "";
    return e.split("@")[0] || "player";
  }
  var passThrough = false;

  function openSignInDialog(sb) {
    var mode = "in";
    var wrap = el("div", { "class": "dlg", role: "dialog", "aria-modal": "true", "aria-labelledby": "h2hDlgT" });
    var box = el("form", { "class": "dlgBox" });
    var title = el("div", { "class": "dlgTitle", id: "h2hDlgT" }, "Sign in");
    var txt = el("p", {}, "Your rating and record follow you to any device.");
    var gh = el("button", { type: "button", "class": "btn h2hGh" }); gh.innerHTML = GH_ICON + "<span>Continue with GitHub</span>";
    var or = el("div", { "class": "h2hOr" }, "or");
    var user = el("input", { type: "text", required: "", placeholder: "Username", autocomplete: "username", "aria-label": "Username", maxlength: "20", autocapitalize: "none", autocorrect: "off", spellcheck: "false" });
    var pass = el("input", { type: "password", required: "", placeholder: "Password", autocomplete: "current-password", "aria-label": "Password", minlength: "6" });
    var err = el("p", { "class": "h2hErr", role: "alert" }); err.hidden = true;
    var btns = el("div", { "class": "riskBtns" });
    var no = el("button", { type: "button", "class": "btn ghost" }, "Cancel");
    var yes = el("button", { type: "submit", "class": "btn" }, "Sign in");
    btns.appendChild(no); btns.appendChild(yes);
    var swap = el("button", { type: "button", "class": "h2hAlt" }, "New here? Create an account");
    var guest = el("button", { type: "button", "class": "h2hAlt" }, "Play as guest on this device");
    [title, txt, gh, or, user, pass, err, btns, swap, guest].forEach(function (n) { box.appendChild(n); });
    wrap.appendChild(box); document.body.appendChild(wrap);
    setTimeout(function () { user.focus(); }, 0);
    function close() { wrap.remove(); document.removeEventListener("keydown", esc); }
    function esc(e) { if (e.key === "Escape") close(); }
    function showErr(m) { err.textContent = m; err.hidden = false; }
    function setMode(m) {
      mode = m; err.hidden = true;
      title.textContent = m === "in" ? "Sign in" : "Create account";
      yes.textContent = m === "in" ? "Sign in" : "Create account";
      swap.textContent = m === "in" ? "New here? Create an account" : "Already have an account? Sign in";
      pass.setAttribute("autocomplete", m === "in" ? "current-password" : "new-password");
      pass.placeholder = m === "in" ? "Password" : "Password (6+ characters)";
    }
    document.addEventListener("keydown", esc);
    no.onclick = close;
    wrap.addEventListener("click", function (e) { if (e.target === wrap) close(); });
    swap.onclick = function () { setMode(mode === "in" ? "up" : "in"); user.focus(); };
    guest.onclick = function () { close(); passThrough = true; byId("signIn").click(); };
    gh.onclick = function () {
      gh.disabled = true;
      sb.auth.signInWithOAuth({ provider: "github", options: { redirectTo: location.origin + location.pathname } }).then(function (r) {
        if (r.error) { gh.disabled = false; showErr("GitHub sign-in isn't available right now: " + r.error.message); }
      });
    };
    box.onsubmit = function (e) {
      e.preventDefault(); err.hidden = true;
      var name = user.value.trim(), pw = pass.value;
      if (!/^[A-Za-z0-9_.-]{3,20}$/.test(name)) { showErr("Usernames are 3 to 20 letters, numbers, dots, dashes or underscores."); user.focus(); return; }
      if (pw.length < 6) { showErr("Passwords need at least 6 characters."); pass.focus(); return; }
      var email = name.toLowerCase() + "@" + USER_DOMAIN;
      yes.disabled = true; var label = yes.textContent; yes.textContent = "One moment...";
      var call = mode === "in"
        ? sb.auth.signInWithPassword({ email: email, password: pw })
        : sb.auth.signUp({ email: email, password: pw, options: { data: { username: name } } });
      call.then(function (r) {
        yes.disabled = false; yes.textContent = label;
        if (r.error) {
          var m = r.error.message || "";
          if (/invalid login/i.test(m)) showErr("Wrong username or password.");
          else if (/already registered|already exists/i.test(m)) showErr("That username is taken. Try another, or sign in.");
          else if (/not confirmed/i.test(m)) showErr("This account still needs confirming. The game's owner needs to turn off email confirmation in Supabase.");
          else showErr(m);
          return;
        }
        if (!r.data || !r.data.session) { showErr("Account created, but it needs confirming. The game's owner needs to turn off email confirmation in Supabase."); return; }
        location.reload();
      });
    };
  }

  // Create (or switch to) the game profile named after the account, using the game's own prompt.
  function autoProfile(name) {
    var tries = 0;
    (function wait() {
      var g = window.__h2h;
      if (!(g && g.ACCT && g.ACCT.ready)) { if (++tries < 80) setTimeout(wait, 250); return; }
      if (g.ACCT.store.active) return;
      passThrough = true; byId("signIn").click();
      setTimeout(function () {
        var inp = byId("dlgInput"); if (!inp || byId("dlg").hidden) return;
        inp.value = name; byId("dlgYes").click();
      }, 0);
    })();
  }

  function mount() {
    var st = el("style"); st.textContent = css; document.head.appendChild(st);
    var signIn = byId("signIn"), signOut = byId("signOut");
    if (!signIn) return;
    Promise.all([clientP, sessionP]).then(function (a) {
      var sb = a[0], s = a[1];
      if (!sb) return; // Supabase unreachable: the game's own guest sign-in stays as is
      var hint = document.querySelector("#acctOut .acct-hint");
      signIn.addEventListener("click", function (e) {
        if (passThrough) { passThrough = false; return; }
        if (s) return; // signed in: the game's name prompt (switch player) is fine
        e.stopImmediatePropagation(); e.preventDefault();
        openSignInDialog(sb);
      }, true);
      if (!s) {
        signIn.textContent = "Sign in";
        if (hint) hint.textContent = "Sign in to track your rating, wins, losses and streak on any device.";
        return;
      }
      var name = displayName(s.user);
      signIn.textContent = "Choose player name";
      if (hint) hint.textContent = "Signed in as " + name + ".";
      var where = byId("acctWhere");
      if (where) new MutationObserver(function () {
        var want = "Signed in as " + name + ". Saved to your account on every device.";
        if (/account/.test(where.textContent) && where.textContent !== want) where.textContent = want;
      }).observe(where, { childList: true, characterData: true, subtree: true });
      if (signOut) signOut.addEventListener("click", function () {
        setTimeout(function () { sb.auth.signOut().then(function () { location.reload(); }); }, 600);
      });
      autoProfile(name);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
