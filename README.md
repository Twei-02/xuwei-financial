# Ledger — a personal finance tracker

A small, self-hosted web app for tracking flexible monthly income/expenses and savings goals. No backend, no account, no build step — just static files.

## What's inside

- `index.html` — the monthly ledger: add income or expenses under any category you like, see totals, balance, and a spend breakdown.
- `savings.html` — savings goals: add as many goals as you want, each with its own target date. Shows % achieved, how much is still needed, and how much to save per month to hit the deadline.
- `style.css` — all styling.
- `app.js` — all the logic and formulas (well-commented — search for `FORMULA` to see every calculation).

All data is saved in your browser's `localStorage`. It stays on whichever device/browser you use the site from — there's no server and no sync between devices.

## Deploying to GitHub Pages

1. Create a new repository on GitHub (e.g. `ledger`).
2. Upload these four files (`index.html`, `savings.html`, `style.css`, `app.js`) to the root of the repository.
3. Go to **Settings → Pages** in your repository.
4. Under **Build and deployment**, set **Source** to `Deploy from a branch`.
5. Choose the `main` branch and `/ (root)` folder, then click **Save**.
6. Wait a minute or two — GitHub will give you a URL like `https://yourusername.github.io/ledger/`.

That's it — open that link on your phone or laptop and start logging.

## Running it locally first (optional)

You can also just double-click `index.html` to open it directly in a browser before you deploy anything — everything works offline.

## Customizing

- Colors, fonts, and spacing all live in `style.css` under `:root` at the top — change the hex values there to re-theme the whole app.
- Currency is hard-coded as `RM` (Malaysian Ringgit) in the `fmt()` function in `app.js` — change that if you'd like a different currency symbol/locale.
