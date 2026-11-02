# Nudgy in 3 minutes

A script for the hackathon demo video (3 minutes max). **Say** is the voiceover; **Do** is what's on screen.
The video is a main judging artifact, so each part below is tied to a score: Impact 30%, Use of Meta AI tooling 25%, Technical depth 20%, Demo 25%.

## Before you hit record

- Fresh browser profile (or incognito), Chill or Cheeky theme, app at the deployed URL (or http://localhost:5173).
- Open the Render logs in a tab, so you can show `engine=open model=meta-models/muse-spark-open-1026` and `engine=modal` on real nudges.
- Enter a name, skip the tutorial, close the daily rundown.
- Add one task with **Photo proof** on, due a minute ago: "Buy oat milk". Earn one badge beforehand so "Create my badge" is ready.
- Log in to sync on the laptop; have your phone logged in to the same email.
- Sound on for the mic. Each take costs roughly: 2-3 Spark calls, 1 nudge each on Baseten and Modal, 1 SAM 3.1 check, 1 badge (a Muse Wonder prompt plus one Muse Image), 1 Plan my day (up to 5 Spark calls). Rehearse with the UI only, and do one full take.
- Have a real reminder email open in your inbox for the cut at 2:30.
- Only show what was built during the hackathon. Say so in the first line.

## The script

**0:00 – 0:15 · Hook and the person it's for** (Impact)
- Do: landing page, scroll once, tap Let's go.
- Say: "I forget things when I'm busy, and reminder apps need me to be organised first. Nudgy doesn't. Everything you'll see, I built from scratch during this hackathon with Meta's models."

**0:15 – 0:45 · Say it messy, get it tidy** (Muse Voice Transcribe + Muse Spark)
- Do: tap the mic and say: *"ugh ok, call the dentist, pay rent by tomorrow I can't forget, and I need to get to Yinka's tomorrow like 5, maybe repaint the shelf sometime… send."*
- Do: the list fills in: the dentist with a "When should I nudge you?" question, rent as High priority, Yinka's tomorrow at 5 PM, the shelf as Low.
- Say: "Muse Voice Transcribe turns my voice into text live. Muse Spark works out times, repeats and how much each thing matters: rent is high, the shelf is low."

**0:45 – 1:05 · It knows your list, and acts on it** (agentic)
- Do: type *"actually move Yinka's to 7 and snooze the dentist"*. Nudgy changes the time, then asks *How long should I snooze it?* Answer *"30 min"*.
- Say: "One message, several changes, no duplicates. It asks before it snoozes, and snoozing is free."

**1:00 – 1:10 · Plan my day** (agentic, take these 10 seconds from the next parts)
- Do: with two overdue reminders, tap Plan it. Let the steps fill in, including a refused time, then tap Undo.
- Say: "Plan my day is an agent. It checks my day and moves things one step at a time. When the server refuses a time, it tries again."

**1:05 – 1:30 · Nudges on open weights, on two hosts** (Muse Spark Open)
- Do: show the overdue oat milk on Today, with Done and Snooze and the dark model tag: *Muse Spark Open · Baseten*. Open Me, set Nudge voice to Modal. Go to Nudges, tap Nudge me, and let the tag change to *Muse Spark Open · Modal*. Tap Snooze and show 30 min / 1 hour / 90 min.
- Say: "When something is due, Nudgy nudges with a fresh line, getting louder until it's done. The tag always shows which model did the work. This is Muse Spark Open, an open-weights model, running on Baseten. One switch and the same model runs on Modal, with Muse Spark as the backup."

**1:30 – 2:00 · Pics or it didn't happen** (SAM 3.1)
- Do: tap Done on the oat milk, then Snap it +15, pick a photo, Claim. Confetti, coins go up. Briefly point at "Skip photo".
- Say: "For errands I can show proof. SAM 3.1 finds the actual oat milk in my photo, so it isn't just a tick. Skip it and you still get the normal coins, just no bonus."

**2:00 – 2:30 · Badge art that is yours** (Muse Wonder + Muse Image)
- Do: open Rewards, tap Create my badge. Show the badge that comes back, in the theme colours and with the user's own tasks around the edge.
- Say: "Muse Wonder writes the art direction from what I actually finished, and Muse Image draws it. Nobody else has this badge."

**2:30 – 2:50 · Built to hold up** (Technical depth)
- Do: quick cuts: a reminder email in the inbox; a recurring task skipping a missed day; the Render log showing `[usage]` lines.
- Say: "If I'm not in the app, reminders reach my email on a schedule, and they hold off while I sleep. Every call is capped and logged, and if a model fails there's a fallback, so a nudge is never lost."

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
