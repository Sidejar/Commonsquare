# CommonSquare

A civic debate platform. Every day there is one **Topic of the Day**: a neutral briefing on a news story, how left- and right-leaning outlets are covering it, and a single Yes/No question anyone can vote on and discuss. Members take a political-compass quiz, get an archetype, and can challenge each other to structured, cross-spectrum debates.

Live at [commonsquare.app](https://commonsquare.app). How the product works — surfaces, debate rules, XP, data model, decisions — is in [docs/product-architecture.md](docs/product-architecture.md). Read that first.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres, Auth, RLS, pg_cron, Edge Functions) · Vercel · Anthropic API.

## Run it

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev
```

## Layout

| Path | What |
|---|---|
| `src/app` | Pages and API routes (`/topics`, `/debates`, `/lounge`, `/quiz`, `/admin/*`, `/api/*`) |
| `src/lib` | Supabase clients, fetchers, quiz/archetype logic, `database.types.ts` |
| `src/components` | `cs/*` design-system primitives, feature components |
| `supabase/migrations` | SQL applied to the CommonSquare Supabase project |
| `supabase/functions/daily-topic` | Edge function that writes the Topic of the Day |
| `docs` | Product architecture, design brief, compass spec, landing copy |

## Topic of the Day automation

A Supabase cron job calls the `daily-topic` edge function every morning (10:00 UTC). It reads the day's headlines from 22 left / center / right RSS feeds, has Claude pick one story covered across the spectrum and write the briefing and the Yes/No question, and publishes it. Details and operating notes: [docs/product-architecture.md §11](docs/product-architecture.md).

- Admin console: `/admin/topics/auto` (run log, run now, draft, feed test). Manual topics: `/admin/topics/new`.
- One-time setup: `supabase secrets set ANTHROPIC_API_KEY=... --project-ref fyhjusydcmbcsisflmao`
- Deploy the function: `supabase functions deploy daily-topic --project-ref fyhjusydcmbcsisflmao --no-verify-jwt --use-api`
- Test its logic: `node --experimental-strip-types supabase/functions/daily-topic/lib.test.ts`
