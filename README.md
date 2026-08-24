# hivvo-web

Frontend for Hivvo — a personal finance app built around how Brazilian credit
cards actually work.

[app.hivvo.app](https://app.hivvo.app) · [backend repo](https://github.com/lucasdonnangelo/hivvo-api)

[![CI](https://github.com/lucasdonnangelo/hivvo-web/actions/workflows/ci.yml/badge.svg)](https://github.com/lucasdonnangelo/hivvo-web/actions/workflows/ci.yml)

---

## The problem

Most personal finance software assumes **a transaction is an expense in the
month it happened**. In Brazil that assumption is wrong often enough to make the
numbers useless, for two reasons that compound.

**1. Instalments are the default, not the exception.** Brazilian retail runs on
`parcelamento`: a R$ 1,200 purchase is routinely charged as *12x de R$ 100*, at
no interest, and this is simply how people buy. So a purchase in March is not a
March expense — it is twelve monthly obligations spread across a year, eleven of
them in months that have not happened yet.

**2. The billing cycle is not the calendar month.** A card has a **closing day**
(`fechamento`) and a separate **due day** (`vencimento`), usually in different
months. Buy on the 8th when the card closes on the 5th, and the charge does not
land on the invoice about to be paid — it lands on the *next* one, due roughly
seven weeks later. That mapping depends on the card, and each of a person's
cards has different days.

Put together: **the month a purchase happened, the month it is billed, and the
month it is paid are three different months.**

### What that means for the interface

The modelling problem belongs to the backend. The **presentation** problem
belongs here, and it is not smaller.

Because of the above, "how much did I spend this month?" has two legitimate
answers — *cash flow* (what leaves the account now) and *consumption* (what was
bought now) — and they are different numbers. A UI that shows one big total is
lying to the user about which question it answered.

So the interface has to make the lens **visible and switchable** without turning
the dashboard into a control panel. Getting that right — showing two truths
without making the user learn accounting — is most of the design work in this
repo. An instalment has to read as *2 of 12* at a glance; a card has to show
what is closing versus what is due; a month has to say which sense of "month" it
means.

---

## What it does

Verified against the code, not the roadmap.

- **Dashboard** — monthly overview with month navigation, income/expense
  summary, comparison against the previous month, category breakdown, open
  invoices, upcoming commitments, and progressive onboarding for new accounts.
- **Transactions** — search and filtering by type, multiple categories, payment
  method and amount range; grouped by date with a running filtered total;
  inline instalment badges.
- **Add transaction** — currency-formatted input, category grid with custom
  categories, instalment split with per-instalment amount, AI category
  suggestion, and a live balance-impact preview on desktop.
- **Cards and invoices** — per-card limit usage, month grid, invoice detail
  separating instalments from one-off charges, invoice payment, PDF export, and
  instalment management.
- **PDF import** — credit card statements and bank statements, with a review
  step before anything is committed.
- **AI assistant** — chat grounded in the user's real financial data.
- **Analysis** — a dedicated summary view, projections and evolution charts.
- **Settings and profile** — categories, recurring entries, preferences, data
  export, account deletion.
- **PWA** — installable, with a service worker precaching the app shell.

---

## Architecture

```
                    ┌──────────────────────┐
   browser ────────▶│  hivvo-web (Vercel)  │
                    │  React 19 · Vite     │
                    │  ← you are here      │
                    └──────────┬───────────┘
                               │  HTTPS, httpOnly cookies
                               ▼
                    ┌──────────────────────┐        ┌─────────────────┐
                    │  hivvo-api (Railway) │───────▶│  Gemini API     │
                    │  FastAPI · SQLModel  │        └─────────────────┘
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │  Supabase (Postgres) │
                    └──────────────────────┘
```

| Choice | Why |
|---|---|
| **React 19 + TypeScript** | Types across the API boundary. The domain has enough near-miss concepts — billing month vs purchase month, instalment vs one-off — that catching a mix-up at compile time is worth the ceremony. |
| **Vite** | Fast dev loop, and a build that a component harness can drive headlessly without a backend. |
| **TanStack Query** | Server state is cached, invalidated and refetched by the library instead of by hand-rolled effects. Confirming an invoice payment invalidates the queries that depend on it, and the dashboard total updates without a manual refresh. |
| **Zustand** | Client state only — auth and preferences. Deliberately small: most state here is *server* state, which belongs to Query, not to a store. |
| **React Hook Form + Zod** | One schema is both the runtime validation and the inferred TypeScript type. The add-transaction form has interdependent fields, and a single source for shape and rules is what keeps that manageable. |
| **Tailwind** | Design tokens live in config, so the palette and spacing scale are defined once rather than drifting across components. |
| **httpOnly cookies, never localStorage** | Auth tokens are unreachable from JavaScript, which removes the entire class of token-theft-by-XSS. Costs CSRF handling; the trade is worth it. |
| **Recharts** | Composable charts in React rather than an imperative charting library wrapped in effects. |

---

## Engineering decisions

### 1. The two lenses are a UI problem, not just a data problem

The backend can serve cash flow and consumption. The interface still has to
decide **which one a given screen means**, and say so.

The failure mode being avoided is a dashboard that shows a single confident
number computed one way while the user reads it the other way. That is worse
than showing nothing, because it looks authoritative. Where both matter, both
appear, labelled — and the cost of that clarity is accepted rather than
optimised away.

### 2. Auth in httpOnly cookies, with a refresh queue

Tokens are never in `localStorage` and never in JavaScript reach.

The consequence is that token refresh happens in an Axios response interceptor,
and that interceptor has a real concurrency problem: several requests can get a
401 at the same moment, and naively each would fire its own refresh. So refresh
is guarded by a flag and a **queue** — the first 401 triggers the refresh, the
rest wait on it and replay once it resolves. One refresh, not six, and no
request silently dropped.

### 3. Presentational components stay ignorant

Components that render do not know about the HTTP client or the store. Data and
callbacks come in as props.

This is not architectural taste for its own sake. It is what lets a component be
mounted **alone, in a headless browser, with no backend and no auth** — which is
how several real bugs were found before they reached a page: a cross-field card
validation, a touch target below the accessible minimum, and a brand-colour
collision. A component that reaches for a store cannot be exercised that way.

### 4. The component harness, and where its seeds come from

`dev/` holds a harness that mounts single components against fixed data, driven
over the Chrome DevTools Protocol.

The detail that makes it honest: the seed data is **captured from the real API**
by a script in the backend repo, which runs the actual endpoints against an
isolated in-memory database and records each response under its query key. So
the harness exercises components against response shapes the API genuinely
produces — not against fixtures someone hand-wrote to match what they assumed.

### 5. Strict CSP, set at the edge

`vercel.json` ships a restrictive Content Security Policy: `default-src 'self'`,
no `object-src`, no `unsafe-eval`, framing denied, and `connect-src` restricted
to the API origin and the error-monitoring ingest.

It is enforced by the host on every response rather than by a meta tag, so it
cannot be bypassed by markup injected into the document. Alongside it:
`Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy:
no-referrer`, and a `Permissions-Policy` that switches off device APIs the app
has no reason to touch.

---

## Testing and quality

**48 tests** across 6 files (`vitest run`), covering the pure logic layer —
onboarding rules, previous-route tracking, error-detail extraction, preference
handling, feedback rules, and the invoice-import helpers.

**Scope, stated honestly:** these are unit tests over `src/lib` and helpers.
There is **no jsdom / Testing Library setup**, so React components are not
covered by the automated suite. Component behaviour is verified through the
headless harness described above, which is driven manually rather than in CI.
Closing that gap is known work, not an oversight being hidden.

**CI on every push** — lint, tests and a full production build, on the Node
version pinned by `.nvmrc`, which is the single source shared by local, CI and
deploy.

**`npm ci`, not `npm install`.** The lockfile is the pin and CI is strict about
it. That distinction was not theoretical here: the lockfile had been broken for
months, masked locally by `npm install`, and the first strict CI run rejected it
immediately. The regenerated lock was then **falsified against five npm
versions** before being accepted.

**A pre-push hook** runs tests and build locally. It is fast feedback, not a
barrier: `--no-verify` skips it, by design.

**What actually blocks, stated precisely — because it is less than it looks.**
CI runs on every push and reports, but **nothing today prevents merging or
pushing past a red result.** A branch ruleset is configured and shows as active,
with force-push blocking and required status checks; it does not take effect,
because repository rulesets are not enforced on private repositories under the
free plan. That was measured, not assumed: a force push went through on both
repositories with no bypass and no configuration change.

So the honest position is that the gates here are **informational and local**,
and the discipline is the enforcement. This changes when the repositories become
public and the ruleset starts applying — which is a thing to **re-measure at
that point rather than assume**, since the same configuration has already proven
capable of being inert while looking active.

Full detail on the method in [docs/ENGINEERING.md](docs/ENGINEERING.md).

---

## How this was built

Built with AI assistance, and the method is the part worth describing.

Design was settled and reviewed **before** code, in writing. Verification was by
mutation, not by coverage: reintroduce the defect and watch the test fail, or the
test does not count. When a measurement contradicted a documented assumption, the
old claim was **struck through with the date and the evidence**, never quietly
deleted — so the correction survives the next reader.

Two examples, both real. A backend test that had always passed because it
asserted over an empty set, found by mutation and rewritten against a public
contract. This repo's lockfile, broken for months behind `npm install`, caught
the first time strict `npm ci` ran — then falsified across five npm versions
before the replacement was trusted.

The tooling is fast. Deciding what would have to be true for a green result to
mean something is the part that is not, and that part does not come from a model.

---

## Running locally

Requires **Node 24** (see `.nvmrc`) and a running [hivvo-api](https://github.com/lucasdonnangelo/hivvo-api).

```bash
git clone https://github.com/lucasdonnangelo/hivvo-web.git
cd hivvo-web

npm ci                      # ci, not install — respects the lock
cp .env.example .env        # then set VITE_API_URL

npm run dev                 # http://localhost:5173
```

```bash
npm test                    # 48 tests
npm run lint
npm run build               # tsc -b && vite build
npm run preview             # serve the production build
```

### Environment variables

Never commit real values. `.env` is gitignored; `.env.example` documents the
shape.

| Variable | Required | What it does |
|---|---|---|
| `VITE_API_URL` | **yes in production** | API base URL, **including** the `/api/v1` prefix. Falls back to localhost in dev. In a production bundle it is required at **runtime, not build time**: the build succeeds without it and the app then throws on load, so a misconfigured deploy ships green and fails in the browser. |
| `VITE_SENTRY_DSN` | no | Error monitoring. Absent is a no-op **by design** — dev errors go to the console. |
| `SENTRY_AUTH_TOKEN` | no | Build-time source map upload. Server-side only; deliberately **not** `VITE_`-prefixed so it never reaches the browser. |
| `SENTRY_ORG` | no | As above. Without all three, the plugin drops out of the build and no maps are uploaded. |
| `SENTRY_PROJECT` | no | As above. |

---

## Repo map

```
src/
  pages/        one folder per route — Dashboard, Transactions, Cards,
                AddTransaction, Import, Assistant, Settings, Profile, Auth, Legal
  components/   reusable UI — cards, charts, transaction pieces, primitives
  layouts/      desktop and mobile shells, with distinct navigation
  services/     API client and per-resource calls; Axios instance + auth interceptor
  store/        Zustand — auth and preferences only
  hooks/        shared React hooks
  lib/          pure logic, and where the test suite lives
  styles/       Tailwind entry and design tokens
dev/            component harness + CDP drivers; seeds captured from the real API
public/         PWA manifest, icons, static assets
docs/           product reference, design decisions, engineering practices
```

---

## Status and limitations

Feature-complete for its core and running in production. Honest gaps:

- **No component tests in CI.** The suite covers pure logic; component
  verification runs through the headless harness, driven by hand. Adding jsdom
  and Testing Library is known work.
- **Charts are not fully responsive at every breakpoint**, and the harness does
  not resize the physical viewport — so responsive behaviour is verified by
  reading the code and by manual checks, not by an automated gate.
- **Portuguese only.** No i18n layer; strings are inline. Adding one is a real
  refactor, not a config switch.
- **Dependencies:** 2 moderate advisories reach production, both in react-router
  6.x. Neither is reachable in this app — one requires SSR, which this SPA does
  not use, and the other requires a user-controlled navigation target, which
  does not exist in the codebase (every `navigate()` and `to=` is a literal or
  comes from a static config array). The fix is the 7.x major, a routing-breaking
  upgrade, and is not pre-launch work.

<!-- SCREENSHOT: dashboard — mobile and desktop side by side -->
<!-- SCREENSHOT: add transaction — instalment split with per-instalment amount -->
<!-- SCREENSHOT: invoice detail — instalments vs one-off charges -->
<!-- SCREENSHOT: PDF import — review step before commit -->

---

The backend lives in [hivvo-api](https://github.com/lucasdonnangelo/hivvo-api).

## License

Source is published for evaluation and portfolio review. **All rights
reserved** — no licence is granted for use, modification or redistribution.
