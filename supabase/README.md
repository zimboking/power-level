---
ontology: true
type: guide
domain: power-level
status: active
tags: [supabase, crews, setup, auth]
related: [schema, CLAUDE]
summary: One-time Supabase setup that switches on Crews (email-code sign-in, crews, feed, leaderboard)
---

# Setting up Crews on Supabase

Crews stay hidden in the app until `js/social-config.js` has a project URL and key. Setup takes
about 15 minutes, once.

## 1. Make the project

1. In the Supabase dashboard, create a new project. Pick the **Sydney** region so it's quick for
   Australian phones. Keep the database password somewhere safe (the app never needs it).
2. Open **SQL Editor**, paste all of [`schema.sql`](schema.sql), and press **Run**. It's safe to run
   again after changes.

## 2. Sign-in by emailed code

Supabase emails a magic link by default. To send a 6-digit code instead:

1. **Authentication → Sign In / Providers → Email**: leave Email on. Set the **email OTP length**
   to 6 if it asks.
2. **Authentication → Emails → Templates → Magic Link**: replace the link with the code, e.g.
   `<p>Your Power Level code is <b>{{ .Token }}</b></p>`. Do the same in **Confirm signup**, since a
   new person's first email uses that template.

## 3. Email sending (important)

Supabase's built-in email is for testing only. It sends to your own team's addresses and only a
few emails an hour. For your mates to get codes, add your own SMTP under
**Authentication → Emails → SMTP Settings**. Free options:

- **Brevo**: about 300 emails a day free, and you can verify a single sender address without
  owning a domain.
- **Resend**: 3,000 a month free, but it needs a domain you own to email other people.

Then raise **Authentication → Rate Limits → emails sent per hour** to suit (e.g. 30).

## 4. Connect the app

From **Project Settings → API Keys**, copy:

- the **Project URL** (`https://<ref>.supabase.co`)
- the **publishable** key (older projects call it the `anon` `public` key)

Put both in [`js/social-config.js`](../js/social-config.js), run `npm run build`, and push.
Both values are meant to be public: the security rules in `schema.sql` decide what anyone can do.
**Never** use the `service_role` or secret key in the app.

## What's stored, and who can see it

| Table | What | Who can read it |
| --- | --- | --- |
| `profiles` | Name, emoji, power level, tier, streak, sessions, optional best 1RMs | You and your crewmates |
| `crews`, `crew_members` | Crew name, invite code, members | Members of that crew |
| `posts` | Each workout from the last 2 weeks: name, date, sets, kg moved, minutes, exercise names, PRs | You and your crewmates |
| `reactions` | 👊 🔥 💪 on posts | People who can see the post |

Notes, body weight, food, water and photos never leave the phone. Joining a crew only works with
its invite code, and nobody can list crews they aren't in. "Remove my Crew data" in the app deletes
a person's posts, reactions, profile and memberships. Their sign-in account stays in
**Authentication → Users**, where you can delete it.

To check the security rules without a project:
`npm i --no-save @electric-sql/pglite@0.3.11 && node supabase/check-rls.mjs supabase/schema.sql`
