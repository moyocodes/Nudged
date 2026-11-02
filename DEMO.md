# Nudgy in 3 minutes

A script for the hackathon demo video (3 minutes max). **Say** is the voiceover; **Do** is what's on screen.
The video is a main judging artifact, so each part below is tied to a score: Impact 30%, Use of Meta AI tooling 25%, Technical depth 20%, Demo 25%.

## Before you hit record

- Fresh browser profile (or incognito), Chill or Cheeky theme, app at the deployed URL (or http://localhost:5173).
- Confirm the open-weights engine is on where you record: `NUDGE_ENGINE=open`, `OPEN_BASE_URL`, `OPEN_API_KEY` and `OPEN_MODEL=meta-models/muse-spark-open-1026`. The server log should show `engine=open` on a nudge.
- Enter a name, skip the tutorial, close the daily rundown.
- Add one task with **Photo proof** on, due a minute ago: "Buy oat milk". Earn one badge beforehand so "Create my badge" is ready.
- Log in to sync on the laptop; have your phone logged in to the same email.
- Sound on for the mic. Each take costs roughly: 2-3 Spark calls, 1 nudge on Baseten, 1 SAM 3.1 check, 1 badge (a Spark prompt plus one Muse Image). Rehearse with the UI only, and do one full take.
- Only show what was built from Oct 27 on. Say so in the first line.

## The script

**0:00 – 0:15 · Hook and the person it's for** (Impact)
- Do: landing page, scroll once, tap Let's go.
- Say: "I forget things when I'm busy, and reminder apps need me to be organised first. Nudgy doesn't. Everything you'll see was built this week with Meta's models."

**0:15 – 0:45 · Say it messy, get it tidy** (Muse Voice Transcribe + Muse Spark)
- Do: tap the mic and say: *"ugh ok, call the dentist, pay rent by tomorrow I can't forget, and I need to get to Yinka's tomorrow like 5, maybe repaint the shelf sometime… send."*
- Do: the list fills in: the dentist with a "When should I nudge you?" question, rent as High priority, Yinka's tomorrow at 5 PM, the shelf as Low.
- Say: "Muse Voice Transcribe turns my voice into text live. Muse Spark works out times, repeats and how much each thing matters: rent is high, the shelf is low."

**0:45 – 1:05 · It knows your list, and acts on it** (agentic)
- Do: type *"actually move Yinka's to 7 and snooze the dentist"*. Nudgy changes the time, then asks *How long should I snooze it?* Answer *"30 min"*.
- Say: "One message, several changes, no duplicates. It asks before it snoozes, and snoozing is free."

**1:05 – 1:30 · Nudges on an open-weights model** (Muse Spark Open)
- Do: the oat-milk nudge shows on Today. Open the Nudges tab: Nudge → Prod → Shove. Tap Snooze and show 30 min / 1 hour / 2 hours.
- Say: "When something is due, Nudgy nudges, with a fresh line every time, getting louder until it's done. These lines come from Muse Spark Open, an open-weights model running on Baseten, with Muse Spark as the backup."

**1:30 – 2:00 · Pics or it didn't happen** (SAM 3.1)
- Do: tap Done on the oat milk, then Snap it +15, pick a photo, Claim. Confetti, coins go up. Briefly point at "Skip photo".
- Say: "For errands I can show proof. SAM 3.1 finds the actual oat milk in my photo, so it isn't just a tick. Skip it and you still get the normal coins, just no bonus."

**2:00 – 2:30 · Badge art that is yours** (Muse Spark + Muse Image)
- Do: open Rewards, tap Create my badge. Show the badge that comes back, in the theme colours and with the user's own tasks around the edge.
- Say: "Muse Spark writes a detailed art prompt from what I actually finished, and Muse Image draws it. Nobody else has this badge."

**2:30 – 2:50 · Built to hold up** (Technical depth)
- Do: quick cuts: a recurring task skipping a missed day instead of piling up as overdue; the server log showing `[usage]` lines.
- Say: "Recurring tasks skip missed days, results are cached, every call is capped and logged, and if a model fails there's a fallback, so a nudge is never lost."

**2:50 – 3:00 · Close**
- Do: hold up the phone. The same list is there, with oat milk ticked.
- Say: "Same list on every device. Nudgy: say it messy, I'll keep it tidy."

## After recording

- Post the video on X and submit the post link on the hackathon platform (Most Viral prize counts engagement until Nov 8 EOD).
- Check that the repo is public and the video link opens without signing in.

## If something goes wrong live

- **The model is slow:** "Nudgy's on it…" shows under the box and you can carry on. Fill the gap with the Nudges tab.
- **The model fails:** the local parser still adds tasks ("My brain's offline, so I winged it").
- **Wrong edit:** type "undo".
