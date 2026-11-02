# Nudgy in 3 minutes

A script for the hackathon demo video (3 minutes max). **Say** is the voiceover; **Do** is what's on screen.
The video is a main judging artifact, so each part below is tied to a score: Impact 30%, Use of Meta AI tooling 25%, Technical depth 20%, Demo 25%.

## Before you hit record

- Fresh browser profile (or incognito), Chill or Cheeky theme, at getnudged.chat. Don't deploy while recording: a deploy loses any model result still waiting.
- Enter a name, skip the tutorial, close the daily rundown. In the Set Nudgy up card, allow Talk out loud and Notifications.
- Add these, due a minute ago: "Go to the bank" with **Photo proof** on, plus "Water the plants". Finish one reminder beforehand so a badge is earned and "Create my badge" is ready.
- Have your phone logged in to the same email, a real photo of a bank ready, and a real reminder email open in your inbox.
- Open the Render logs in a tab, to show `engine=open`, `engine=modal` and `step=plan` lines.
- Set the model switch beside the mic to **Auto**. Auto takes the next model on every call, so the tag order can differ from the script; say what the tag shows.
- Tap the page once before you start, since browsers hold sound until the first tap.
- Rehearse once, and cut the 15-second wait in the edit. The script runs close to 3 minutes, so if a take runs long, drop the 2:30 section first.

## The script

**0:00 – 0:12 · Hook and the person it's for** (Impact)
- Do: landing page, scroll once, tap Let's go.
- Say: "I forget things when I'm busy, and reminder apps need me to be organised first. Nudgy doesn't. Everything you'll see, I built from scratch during this hackathon with Meta's models."

**0:12 – 0:32 · Say it messy, get it tidy** (Muse Voice Transcribe + Muse Spark)
- Do: tap the mic, so the tag and "Connecting" show at once, and say: *"ugh ok, call the dentist, pay rent by tomorrow I can't forget, get to Yinka's tomorrow like 5, maybe repaint the shelf sometime… send."* The list fills in.
- Say: "Muse Voice Transcribe hears me live, and Muse Spark works out times and how much each thing matters: rent is high, the shelf is low."

**0:32 – 0:50 · Every model, and a memory** (Meta tooling, agentic)
- Do: type *"actually move Yinka's to 7"*. Point at the tag, then at the model switch. Reload the page and type *"what did I just move?"*
- Say: "One message changes the list, with no duplicates. The tag shows which model answered. On Auto they take turns: Muse Spark Open on Baseten, the same model on Modal, and Muse Spark on Meta. I reloaded, and it still remembers our conversation."

**0:50 – 1:02 · It notices when you go quiet** (agentic)
- Do: type *"pick up the cake for"* and stop. Cut the wait until Nudgy's line appears.
- Say: "If I stop for 15 seconds, it picks the conversation back up, or nudges me to finish what I started."

**1:02 – 1:20 · Plan my day** (agentic)
- Do: tap Plan it. Let the steps fill in, then tap Undo last change.
- Say: "Plan my day is an agent. It checks my day and moves things one step at a time. If the server refuses a time, it has to try again. And I can undo the whole run."

**1:20 – 1:40 · Nudges on open weights** (Muse Spark Open)
- Do: show the overdue banner with Done and Snooze. Set the switch to Baseten, open Nudges, tap Nudge me: chime, voice, tag. Set it to Modal, tap Nudge me again, and let the tag change.
- Say: "When something's due, Nudgy chimes and nudges with a fresh line, louder until it's done. That's Muse Spark Open, an open-weights model, on Baseten. One switch, and the same model runs on Modal."

**1:40 – 2:00 · Pics or it didn't happen** (SAM 3.1 + Muse Spark)
- Do: tap Done on the bank reminder, then Snap it +15, and pick the bank photo. Claim. Confetti, coins go up.
- Say: "For errands I show proof. SAM 3.1 looks for it in my photo. A bank is hard to outline, so if SAM says no, Muse Spark takes a second look. A wrong photo still gets rejected."

**2:00 – 2:20 · Badge art that is yours** (Muse Wonder + Muse Image)
- Do: open Rewards, open the badge, tap Create my badge. Let the loader play, cut the wait, and show the badge.
- Say: "Muse Wonder writes the art direction from what I actually finished, and Muse Image draws it. Nobody else has this badge."
- Optional, if the take has time: on Me, use Restyle Nudgy, show the new Nudgy, and say "The same two models can redraw Nudgy too."

**2:20 – 2:30 · Work carries on without you** (Technical depth)
- Do: send a brain dump and reload straight away. The tag shows the model working, then the reminder appears.
- Say: "If I close the app mid-thought, the work carries on, and it's there when I'm back."

**2:30 – 2:50 · Built to hold up** (Technical depth)
- Do: quick cuts: a reminder email in the inbox; the Me page voice picker; the Render log showing `[usage]` lines.
- Say: "When I'm away, reminders reach my email on a schedule, and hold off while I sleep. Every call is logged, and if a model fails there's a fallback, so a nudge is never lost."

**2:50 – 3:00 · Close**
- Do: hold up the phone. The same list is there, with the bank ticked.
- Say: "Same list on every device. Nudgy: say it messy, I'll keep it tidy."

## After recording

- Post the video on X and submit the post link on the hackathon platform (Most Viral prize counts engagement until Nov 8 EOD).
- Check that the repo is public and the video link opens without signing in.

## If something goes wrong live

- **The model is slow:** the tag shows it's working and you can carry on. Fill the gap with the Nudges tab.
- **The model fails:** the local parser still adds tasks ("My brain's offline, so I winged it").
- **Wrong edit:** type "undo".
