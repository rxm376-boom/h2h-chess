# H2H Chess

Chess where every capture becomes a real-time arcade duel. Play it in the browser, on desktop or phone.

**Play:** https://rxm376-boom.github.io/h2h-chess/

- `index.html` is the whole game (built from the project prototype).
- `cloud.js` + `config.js` add optional real logins and synced stats through Supabase's free tier.
  With empty keys in `config.js`, stats stay in the player's browser.
- `supabase-setup.sql` creates the one table the game needs, with row-level security.

Hosting is GitHub Pages (free, deploys from the `main` branch root).
