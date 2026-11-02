# Nudgy

**Nudgy is the reminder app that nudges back.** Say or type everything on your mind: Muse Spark turns it into reminders, asks follow-up questions, and Nudgy nudges you until it's done, with lines from the open-weights Muse Spark Open on Baseten or Modal. Voice by Muse Voice Transcribe, photo proof checked by SAM 3.1, personal badges drawn by Muse Image from prompts Muse Spark writes.

Dump everything on your mind, messy, by voice or text. Nudgy turns it into tidy reminders, then nudges you, cheekily and with escalating drama, until each one is done.

Live at [getnudged.chat](https://getnudged.chat). Problem statement: **Build for Your World**. It's for anyone who forgets things when busy and won't organise themselves first, so a reminder app has to do the organising and the chasing.

Everything in this repo was built from scratch for the Meta Global AI Developer Hackathon, Oct 26 – Nov 4, 2026. [NOTES.md](NOTES.md) and the commit history record each feature as it was built. 3-minute walkthrough: [DEMO.md](DEMO.md).

## What it does

- **Messy in, tidy out.** "ugh dentist?? oat milk. yinka's tmrw like 5pm" becomes three reminders with times. Muse Spark fixes typos and mishearings, works out dates, priorities and repeats ("every weekday at 8"), and asks a short, punny question when something essential is missing.
- **It knows your list.** "I called mum", "move the gym to 7" or "cancel the dentist" act on the existing reminder instead of adding a duplicate. Tap **@** on a reminder to give it instructions directly. "Undo" reverses the last change.
- **Nudges until it's done.** Due reminders get a fresh, model-written line, escalating from Nudge to Shove, until you tap Done or Snooze for 30 min, 1 hour or 90 min (snoozing is free). An overdue reminder has its Done and Snooze buttons on Today as soon as you open the app. Sleep hours hold back low-priority nudges. Nudges show as browser notifications when the tab is in the background.
- **Emails when you're away.** A reminder emails you when due, then at gaps of 30, 60, 120 and 240 minutes, with no model call. Nothing goes out during sleep hours, and one morning email lists the day's reminders.
- **Choose the model, see the model.** The Nudge voice setting on the Me page picks who writes your nudges: Muse Spark Open on Baseten, Muse Spark Open on Modal, or Muse Spark on Meta. A tag stays on screen naming the model and host behind the latest call, and each nudge shows its own.
- **Daily goals.** Recurring reminders show as a checklist on Today. A missed day is skipped instead of piling up as overdue.
- **Pics or it didn't happen.** Errands marked as photo proof earn +15 points with a photo, or can be skipped for the normal points.
- **Rewards.** Points, a daily streak and badges, with personal badge art made by Muse Image.
- **Every device.** Log in with just your email, and tasks, chat, points, streak and pictures sync. For the hackathon demo there is no emailed code, so judges can get straight in; a new device gets a login email, and `REQUIRE_SIGNUP_CODE` and `REQUIRE_LOGIN_CODE` turn codes back on.
- **Four personalities.** Chill, Cheeky, Sassy and Night owl themes, each with its own font, look and colour choices.

Nudgy is always warm and cheeky, and a nudge makes sense on first read. Never flirty, never mean, never medical.

## How the AI is used

| Feature | Model | Call happens when |
|---|---|---|
| Voice brain-dump | Muse Voice Transcribe (live, streamed through the server) | You tap the mic |
| Turning a dump into reminders and actions | Muse Spark | You press Add tasks / Enter |
| Nudge lines | Muse Spark Open (open weights) on Baseten or Modal, or Muse Spark, as chosen on the Me page, with Muse Spark as backup | A nudge is actually due, or you tap Nudge me |
| Photo proof | SAM 3.1 finds the task's object in your photo | You send a proof photo |
| Personal badge art | Muse Spark writes the art prompt, Muse Image draws it | You tap Create my badge |

Model output is never trusted blindly. The server drops tasks with no title, turns an unreadable time into a "when?" question, ignores actions that point at reminders that don't exist, and Nudgy's confirmation ("Set: Call mum, today 6 PM") is built from what was really saved, so it can't claim a reminder it didn't make. If a call fails, a local parser and canned nudges keep the app working.

## Tech

- **Frontend:** React 19, Vite, Tailwind CSS v4, Framer Motion and GSAP for motion.
- **Backend:** Express, with the OpenAI SDK pointed at the Meta Model API (`https://api.meta.ai/v1`), and a WebSocket relay for live transcription.
- **The API key stays on the server.** Vite proxies `/api` to Express, so the browser never sees it.
- **Accounts:** passwordless email login, with email sent through Resend. The session is an HTTP-only cookie, stored hashed, and every route that calls a model requires it. Data lives in Postgres or MySQL when `DATABASE_URL` is set (users, devices, synced state, images), or a git-ignored JSON file locally.
- **Hosting:** Render (`render.yaml`), with the Postgres database on Neon and the domain getnudged.chat.

## Setup

1. `npm install`
2. `cp .env.example .env`, then fill in:
   - `MODEL_API_KEY`: your Meta Model API key
   - `MODEL_NAME`: defaults to `muse-spark-1.3`
   - `VOICE_MODEL_NAME`: defaults to `muse-voice-transcribe-1.0`
   - `SAM_MODEL_NAME` and `IMAGE_MODEL_NAME`: for photo proof and badge art
   - `NUDGE_ENGINE=open` plus `OPEN_BASE_URL`, `OPEN_API_KEY`, `OPEN_MODEL` (optional): nudges from Muse Spark Open
   - `MODAL_BASE_URL`, `MODAL_API_KEY`, `MODAL_MODEL` (optional): the Modal choice for nudges
   - `ROUTER_API_KEY` and `ROUTER_MODEL` (optional): Muse Glimmer on Fireworks reads each chat message first. Plain chat ("hey", "thanks") gets its reply from Glimmer; anything that might be a reminder goes to Muse Spark. Off, unsure or failing, everything goes to Muse Spark.
   - `DATABASE_URL` (optional): Postgres (`postgresql://…`) or MySQL (`mysql://…`). Without it, data goes in `server/data/db.json`.
   - `RESEND_API_KEY` (optional): sends welcome, login, reminder and done emails. Without it, none of these go out.
3. `npm run dev` starts Express (port 3001) and Vite (port 5173).
4. Open http://localhost:5173.

## Project layout

```
server/index.js           Model routes: /api/extract, /api/nudge; voice relay /api/asr
server/auth.js            Email device login, session cookie, sync and images
server/db.js              Storage: Postgres, MySQL or the JSON file
server/reminders.js       Reminder, morning, login and done emails
server/sam.js             Photo proof with SAM 3.1
server/image.js           Badge art with Muse Image
src/pages/                Landing, Today, Nudges, Rewards, Me, chat history, photo proof, login
src/components/           Brain dump, task card, nudge scheduler, repeat picker, mascot, story…
src/lib/                  Store, schedule and repeat maths, nudges, themes, account calls
NOTES.md                  Dev log, one entry per feature
```

## Cost rules

Every model call costs money, so the API is called only when you tap a button or a nudge is actually due, never on page load or while typing. Outputs are capped (1000 tokens for nudges, 2000 for extraction, since Muse Spark's reasoning alone used up the earlier 300 and 800), reasoning effort is low on Muse Spark and Muse Spark Open (Meta's hackathon workshop benchmarks found low scores best on short tasks: higher effort spent more tokens, scored lower, and at max sometimes used the whole budget and returned nothing), identical dumps are cached, and the server logs model and token counts per call.
