/* H2H Chess on the open web: real login + synced stats through Supabase (free tier).
   The game itself is unchanged. It already knows how to save to an account through
   window.claude.use("user") and window.claude.use("db"); this file provides those two
   backed by Supabase, plus a small login bar. With no keys in config.js it does nothing
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

  /* ---------- login bar ---------- */
  var css = "#h2hLogin{position:relative;z-index:5;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;" +
    "margin:8px 16px;background:#241d42;border:1px solid #3d3468;color:#f1e9d6;border-radius:10px;padding:6px 10px;" +
    "font:500 13px 'Chakra Petch',system-ui,sans-serif;}" +
    "#h2hLogin button{font:inherit;font-weight:600;background:#e8b04a;color:#191430;border:0;border-radius:7px;padding:6px 10px;cursor:pointer}" +
    "#h2hLogin button.ghost{background:transparent;color:#a89ec4;border:1px solid #3d3468}" +
    "#h2hLogin input{font:inherit;min-width:0;width:200px;max-width:45vw;background:#191430;color:#f1e9d6;border:1px solid #3d3468;border-radius:7px;padding:6px 8px}" +
    "#h2hLogin .msg{color:#a89ec4}#h2hLogin form{flex-wrap:wrap;justify-content:center}";
  function el(tag, attrs, text) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (text) e.textContent = text; return e; }
  function mount() {
    var st = el("style"); st.textContent = css; document.head.appendChild(st);
    var bar = el("div", { id: "h2hLogin", role: "region", "aria-label": "Account login" });
    document.body.insertBefore(bar, document.body.firstChild);
    Promise.all([clientP, sessionP]).then(function (a) {
      var sb = a[0], s = a[1];
      if (!sb) { bar.remove(); return; }
      bar.innerHTML = "";
      if (s) {
        bar.appendChild(el("span", { "class": "msg" }, "Logged in as " + (s.user.email || "player") + ". Stats sync across devices."));
        var out = el("button", { "class": "ghost", type: "button" }, "Log out");
        out.onclick = function () { sb.auth.signOut().then(function () { location.reload(); }); };
        bar.appendChild(out);
        return;
      }
      var hide = sessionStorageGet("h2h.loginHidden");
      if (hide) { var show = el("button", { "class": "ghost", type: "button" }, "Log in"); show.onclick = function () { sessionStorageSet("h2h.loginHidden", ""); location.reload(); }; bar.appendChild(show); return; }
      var form = el("form", { style: "display:flex;gap:8px;align-items:center;margin:0" });
      var lbl = el("span", { "class": "msg" }, "Log in to sync your stats across devices");
      var inp = el("input", { type: "email", required: "", placeholder: "you@email.com", "aria-label": "Email", autocomplete: "email" });
      var go = el("button", { type: "submit" }, "Email me a link");
      var x = el("button", { "class": "ghost", type: "button", "aria-label": "Hide" }, "Later");
      x.onclick = function () { sessionStorageSet("h2h.loginHidden", "1"); bar.innerHTML = ""; var b = el("button", { "class": "ghost", type: "button" }, "Log in"); b.onclick = function () { sessionStorageSet("h2h.loginHidden", ""); location.reload(); }; bar.appendChild(b); };
      form.appendChild(lbl); form.appendChild(inp); form.appendChild(go);
      bar.appendChild(form); bar.appendChild(x);
      form.onsubmit = function (e) {
        e.preventDefault(); go.disabled = true; go.textContent = "Sending...";
        sb.auth.signInWithOtp({ email: inp.value.trim(), options: { emailRedirectTo: location.origin + location.pathname } }).then(function (r) {
          bar.innerHTML = "";
          bar.appendChild(el("span", { "class": "msg" }, r.error ? "Couldn't send: " + r.error.message : "Check your email and tap the link to log in."));
        });
      };
    });
  }
  function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
