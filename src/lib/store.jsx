// Prototype state: tasks, nudges, points and streak, kept in localStorage.
// No model calls here; extraction and nudges are mocked until the real routes exist.
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { DEFAULT_SCHEDULE, nextOccurrence } from './schedule.js'
import { applyAccent } from './themes.js'
import { logout, pullState, pushState, taskDone, uploadImage } from './account.js'
import { isEarly, isOverdue } from './format.js'
import { snoozeLine } from './phrases.js'
import { SNOOZE_OPTIONS } from './nudges.js'

// How many open reminders one person can have at a time.
export const MAX_OPEN_TASKS = Number(import.meta.env.VITE_MAX_OPEN_TASKS) || 30

const StoreContext = createContext(null)

// v2 drops the old sample tasks and nudges so everyone starts with an empty list.
try {
  if (localStorage.getItem('nudgy:v') !== '2') {
    ;['tasks', 'nudges', 'points', 'streak', 'streakDay', 'snoozes'].forEach((k) => localStorage.removeItem(`nudgy:${k}`))
    localStorage.setItem('nudgy:v', '2')
  }
} catch {}

function load(key, fallback) {
  try {
    const v = localStorage.getItem(`nudgy:${key}`)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}

function usePersisted(key, fallback) {
  const [value, setValue] = useState(() => load(key, fallback))
  useEffect(() => {
    try {
      localStorage.setItem(`nudgy:${key}`, JSON.stringify(value))
    } catch {}
  }, [key, value])
  return [value, setValue]
}

const snoozeLabel = (minutes) => SNOOZE_OPTIONS.find((o) => o.minutes === minutes)?.label ?? `${minutes} min`

export const POINTS_PER_TASK = 10
export const PROOF_BONUS = 15
export const GAME_COST = 5

export function StoreProvider({ children }) {
  const [name, setName] = usePersisted('name', '')
  const [tasks, setTasks] = usePersisted('tasks', [])
  const [nudges, setNudges] = usePersisted('nudges', [])
  const [points, setPoints] = usePersisted('points', 0)
  const [streak, setStreak] = usePersisted('streak', 0)
  // The last day (toDateString) something got finished, for the streak. Synced with the account like the streak.
  const [streakDay, setStreakDay] = usePersisted('streakDay', null)
  const [theme, setTheme] = usePersisted('theme', 'chill')
  const [schedule, setSchedule] = usePersisted('schedule', DEFAULT_SCHEDULE)
  // When this person accepted the terms in onboarding; null until then.
  const [termsAcceptedAt, setTermsAcceptedAt] = usePersisted('termsAcceptedAt', null)
  // The welcome intro plays once per visit (tab session), not once ever.
  const [introSeen, setIntroSeenState] = useState(() => {
    try { return sessionStorage.getItem('nudgy:introSeen') === '1' } catch { return false }
  })
  function setIntroSeen(seen) {
    setIntroSeenState(seen)
    try { seen ? sessionStorage.setItem('nudgy:introSeen', '1') : sessionStorage.removeItem('nudgy:introSeen') } catch {}
  }
  const [snoozes, setSnoozes] = usePersisted('snoozes', {})
  const [joke, setJoke] = useState(null)
  // The reminder picked to talk to Nudged about (the @ chip in the brain dump), or null.
  const [aboutTaskId, setAboutTaskId] = useState(null)
  const [buddy, setBuddy] = useState(null)
  const [voiceOn, setVoiceOn] = usePersisted('voiceOn', false)
  const [volume, setVolume] = usePersisted('volume', 0.6)
  // What this user calls their Nudged, e.g. "Moyo's Nudged". Shown in the top bar and greetings, and told to the model.
  const [savedBuddyName, setBuddyName] = usePersisted('buddyName', 'Nudged')
  // Accounts from before the rename still hold the old name.
  const buddyName = String(savedBuddyName ?? '').replace(/\bNudgy\b/, 'Nudged')
  // How often the rundown opens by itself: 'always' (every visit), '4h', 'daily' or 'never' (button only).
  const [rundownMode, setRundownMode] = usePersisted('rundownMode', '4h')
  // This user's own badge art from Muse Image: { badgeId: small image }. Saved, and synced with the account.
  const [badgeArt, setBadgeArt] = usePersisted('badgeArt', {})
  // Nudged's look from Restyle Nudged, or null for the original.
  const [mascotArt, setMascotArt] = usePersisted('mascotArt', null)
  // Master mute: "Sound off" silences everything (music, background sound, alarm, Nudged's voice, notification sound).
  const [muted, setMuted] = usePersisted('muted', false)
  // Whether the user has answered "talk out loud?" (yes or no), so the setup card stops asking.
  const [soundAsked, setSoundAsked] = usePersisted('soundAsked', false)
  // Said No to "talk out loud". Until then the setup card offers it whenever the voice is off.
  const [voiceDeclined, setVoiceDeclined] = usePersisted('voiceDeclined', false)
  // Whether the mic row on the set-up card has been answered. iPhones can report the mic as undecided after every reload.
  const [micAsked, setMicAsked] = usePersisted('micAsked', false)
  // "Not now" on the set-up card, for this visit only.
  const [permsLater, setPermsLater] = useState(() => {
    try { return sessionStorage.getItem('nudgy:permsLater') === '1' } catch { return false }
  })
  // True while a full-screen story (rundown or tutorial) is showing, so other pop-ups wait.
  const [storyOpen, setStoryOpen] = useState(false)
  // Alarm chime when a nudge fires (lib/alarm.js).
  const [alarmOn, setAlarmOn] = usePersisted('alarmOn', false)
  // Which model writes nudge lines: 'auto' (each in turn), 'open' (Muse Spark Open on Baseten), 'modal' (the same on Modal) or 'spark' (Muse Spark on Meta).
  const [nudgeModel, setNudgeModel] = usePersisted('nudgeModel', 'auto')
  // The device voice Nudged speaks with; null means the nicest one on this device.
  const [voiceName, setVoiceName] = usePersisted('voiceName', null)
  // Whether the Alarm sound row in "Set Nudged up" has been answered.
  const [alarmAsked, setAlarmAsked] = usePersisted('alarmAsked', false)
  // Background music during the rundown (lib/music.js).
  const [musicOn, setMusicOn] = usePersisted('musicOn', true)
  // Background sound across the app: null (off), 'rain', 'fire' or 'waves' (lib/ambient.js).
  const [ambient, setAmbient] = usePersisted('ambient', null)
  // One volume for all sounds (lib/volume.js). Background sound plays at a quarter of it.
  const [ambientAsked, setAmbientAsked] = usePersisted('ambientAsked', false)
  // Everything said to and by Nudged in the brain dump, oldest first: { id, at, from: 'you'|'nudgy', text, taskIds? }.
  const [chat, setChat] = usePersisted('chat', [])
  const addChat = (...msgs) =>
    setChat((c) => [...c, ...msgs.map((m, i) => ({ id: `c${Date.now()}${i}`, at: new Date().toISOString(), ...m }))].slice(-500))

  // Nudged's on-screen voice: a speech bubble every time, out loud too when the user turns it on.
  // spoken: the caller already started the speech, inside the tap that phones require.
  const say = (text, { spoken = false } = {}) => setBuddy({ text, spoken, key: Date.now() })
  const [celebration, setCelebration] = useState(null)
  const [tutorialSeen, setTutorialSeen] = usePersisted('tutorialSeen', false)
  const [tutorialOpen, setTutorialOpen] = useState(false)

  const openTutorial = () => setTutorialOpen(true)
  function closeTutorial() {
    setTutorialOpen(false)
    setTutorialSeen(true)
  }

  // The latest Plan my day result, so it can be reopened later and on other devices.
  const [lastPlan, setLastPlan] = usePersisted('lastPlan', null)

  // The colour picked within each theme, e.g. { cheeky: 'teal' }. Missing means the theme's own.
  const [accents, setAccents] = usePersisted('accents', {})
  const setAccent = (themeId, accentId) => setAccents((a) => ({ ...a, [themeId]: accentId }))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    applyAccent(theme, accents[theme])
  }, [theme, accents])

  // Signed-in account: { email } for this device, or null. The session itself is an HTTP-only cookie. See lib/account.js.
  const [account, setAccount] = usePersisted('account', null)
  // A fresh login (not a reload of one already signed in) always opens the rundown.
  const wasSignedIn = useRef(!!account)
  useEffect(() => {
    if (account && !wasSignedIn.current) {
      try { localStorage.setItem('nudgy:rundownOnLogin', '1') } catch {}
    }
    wasSignedIn.current = !!account
  }, [account?.email]) // eslint-disable-line react-hooks/exhaustive-deps
  // timeZone lets the server keep reminder emails out of this person's sleep hours.
  const synced = { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, name, tasks, nudges, points, streak, streakDay, theme, schedule, snoozes, chat, accents, tutorialSeen, badgeArt, mascotArt, rundownMode, nudgeModel, voiceName, buddyName, termsAcceptedAt, voiceOn, volume, muted, soundAsked, voiceDeclined, alarmOn, alarmAsked, musicOn, ambient, ambientAsked, lastPlan, micAsked }
  const setters = { micAsked: setMicAsked, lastPlan: setLastPlan, name: setName, tasks: setTasks, nudges: setNudges, points: setPoints, streak: setStreak, streakDay: setStreakDay, theme: setTheme, schedule: setSchedule, snoozes: setSnoozes, chat: setChat, accents: setAccents, tutorialSeen: setTutorialSeen, badgeArt: setBadgeArt, mascotArt: setMascotArt, rundownMode: setRundownMode, nudgeModel: setNudgeModel, voiceName: setVoiceName, buddyName: setBuddyName, termsAcceptedAt: setTermsAcceptedAt, voiceOn: setVoiceOn, volume: setVolume, muted: setMuted, soundAsked: setSoundAsked, voiceDeclined: setVoiceDeclined, alarmOn: setAlarmOn, alarmAsked: setAlarmAsked, musicOn: setMusicOn, ambient: setAmbient, ambientAsked: setAmbientAsked }
  const [hydrated, setHydrated] = useState(false)

  // On sign-in: the account's saved state wins if there is one; otherwise this device's state seeds it.
  useEffect(() => {
    if (!account) return setHydrated(false)
    let cancelled = false
    pullState()
      .then((saved) => {
        if (cancelled) return
        // Another account's plan must not linger on this device, so a missing one clears it.
        setLastPlan(saved?.state?.lastPlan ?? null)
        if (saved?.state) for (const [k, v] of Object.entries(saved.state)) setters[k]?.(v)
        else pushState(withoutInlineImages(synced)).catch(() => {})
        setHydrated(true)
      })
      .catch((err) => { if (err.status === 401) setAccount(null) })
    return () => { cancelled = true }
  }, [account?.email]) // eslint-disable-line react-hooks/exhaustive-deps

  // A recurring task whose slot was missed on an earlier day isn't "overdue": it skips ahead to its next slot.
  // Today's slot stays put until it's ticked, so the nudges for it still fire.
  const [clock, setClock] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setClock((c) => c + 1), 5 * 60000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    const startOfToday = new Date().setHours(0, 0, 0, 0)
    const missed = tasks.filter((t) => !t.done && t.repeat?.length && t.due && new Date(t.due) < startOfToday)
    if (!missed.length) return
    const ids = new Set(missed.map((t) => t.id))
    setTasks((ts) => ts.map((t) => (ids.has(t.id) ? { ...t, due: nextOccurrence(t.repeat)?.toISOString() ?? t.due, snoozedUntil: null } : t)))
    setNudges((ps) => ps.filter((p) => !ids.has(p.taskId)))
  }, [tasks, hydrated, clock]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pictures go to the account's image store once, and the state keeps a link (/api/images/...) instead.
  // Runs for new pictures and for ones made before signing in. Signed out, they stay in the browser as they are.
  const uploading = useRef(new Set())
  useEffect(() => {
    if (!account || !hydrated) return
    const todo = [
      ...(mascotArt?.startsWith('data:') ? [{ key: `mascot-${mascotArt.length}`, data: mascotArt, put: (url) => setMascotArt((v) => (v === mascotArt ? url : v)) }] : []),
      ...Object.entries(badgeArt).filter(([, v]) => v?.startsWith('data:')).map(([id, v]) => ({ key: `badge-${id}`, data: v, put: (url) => setBadgeArt((all) => (all[id] === v ? { ...all, [id]: url } : all)) })),
      ...tasks.filter((t) => t.photo?.startsWith('data:')).map((t) => ({ key: `photo-${t.id}`, data: t.photo, put: (url) => setTasks((ts) => ts.map((x) => (x.id === t.id && x.photo === t.photo ? { ...x, photo: url } : x))) })),
    ].filter((i) => !uploading.current.has(i.key))
    for (const i of todo) {
      uploading.current.add(i.key)
      uploadImage(i.key, i.data)
        .then(({ url }) => i.put(url))
        .catch((err) => console.warn('[images] upload failed, kept on this device:', err.message))
        .finally(() => uploading.current.delete(i.key))
    }
  }, [account?.email, hydrated, badgeArt, mascotArt, tasks]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pictures not uploaded yet stay out of the sync, so it never carries the image itself.
  const withoutInlineImages = (state) => ({
    ...state,
    mascotArt: state.mascotArt?.startsWith('data:') ? undefined : state.mascotArt,
    badgeArt: Object.fromEntries(Object.entries(state.badgeArt).filter(([, v]) => !v?.startsWith('data:'))),
    tasks: state.tasks.map((t) => (t.photo?.startsWith('data:') ? { ...t, photo: undefined } : t)),
  })

  // After that, every change is saved to the account a moment later.
  const syncKey = JSON.stringify(synced)
  const unsent = useRef(null) // the save still waiting to go, if any
  const sending = useRef(0)
  useEffect(() => {
    if (!account || !hydrated) return
    const send = () => {
      if (unsent.current !== send) return
      unsent.current = null
      sending.current += 1
      pushState(withoutInlineImages(synced))
        .catch((err) => { if (err.status === 401) setAccount(null) })
        .finally(() => { sending.current -= 1 })
    }
    unsent.current = send
    const id = setTimeout(send, 1500)
    return () => clearTimeout(id)
  }, [syncKey, hydrated]) // eslint-disable-line react-hooks/exhaustive-deps

  // Changes from other devices arrive when this one comes back into view, and every 30 seconds while it's open.
  // Saving first when leaving the page, and never pulling over unsaved changes or pictures still uploading.
  const latest = useRef({})
  latest.current = { syncKey }
  useEffect(() => {
    if (!account || !hydrated) return
    let stopped = false
    async function refresh() {
      if (document.hidden || unsent.current || sending.current || uploading.current.size || latest.current.syncKey.includes('"data:')) return
      const saved = await pullState().catch((err) => { if (err.status === 401) setAccount(null) })
      if (stopped || !saved?.state || unsent.current || sending.current) return
      for (const [k, v] of Object.entries(saved.state)) setters[k]?.(v)
    }
    const onVisible = () => {
      if (document.hidden) unsent.current?.()
      else refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    const id = setInterval(refresh, 30000)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
      clearInterval(id)
    }
  }, [account?.email, hydrated]) // eslint-disable-line react-hooks/exhaustive-deps

  async function signOut() {
    try { await logout() } catch {}
    setAccount(null)
  }

  // Never more than MAX_OPEN_TASKS open reminders; extras are dropped (callers tell the user).
  function addTasks(newTasks) {
    setTasks((ts) => [...newTasks.slice(0, Math.max(0, MAX_OPEN_TASKS - ts.filter((t) => !t.done).length)), ...ts])
  }

  // A recurring task never stays done: completing it earns the points and moves it to its next slot.
  function completeTask(id, { proof = false } = {}) {
    const task = tasks.find((t) => t.id === id)
    if (!task || task.done) return
    // Photo proof is optional: without the photo the task still counts, just without the bonus.
    // Ticking counts for the slot it's due at, even before that slot comes round (e.g. ticking today's 9:00 at 00:30),
    // so the next slot is the one after whichever is later: now or the current due time.
    const from = new Date(Math.max(Date.now(), task.due ? new Date(task.due).getTime() : 0))
    const next = nextOccurrence(task.repeat, from)
    if (next) {
      setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, due: next.toISOString(), snoozedUntil: null, lastDoneAt: new Date().toISOString() } : t)))
      setNudges((ps) => ps.filter((p) => p.taskId !== id))
    } else {
      setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: true, proof } : t)))
    }
    if (account) taskDone(task.title).catch(() => {})
    const earned = POINTS_PER_TASK + (proof ? PROOF_BONUS : 0)
    setPoints((p) => p + earned)
    // What kind of finish it was decides which lines Nudged picks.
    const others = tasks.filter((t) => !t.done && t.id !== id).length
    // A repeating task comes straight back, so it never gets the "list is empty" lines.
    const context = others === 0 && !next ? 'allClear' : proof ? 'proof' : task.repeat ? 'recurring' : isOverdue(task) ? 'late' : isEarly(task) ? 'early' : 'plain'
    setCelebration({ task: task.title, earned, key: Date.now(), context })
    // Streak: the first finish of a day adds one if yesterday had one too, otherwise it starts again at 1.
    const today = new Date().toDateString()
    if (streakDay !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString()
      setStreak((n) => (streakDay === yesterday ? n + 1 : 1))
      setStreakDay(today)
    }
  }

  // A new time makes the old nudges about the old time stale, so they go.
  function updateTask(id, changes) {
    const task = tasks.find((t) => t.id === id)
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...changes } : t)))
    if ('due' in changes && changes.due !== task?.due) setNudges((ps) => ps.filter((p) => p.taskId !== id))
  }

  function deleteTask(id) {
    setTasks((ts) => ts.filter((t) => t.id !== id))
    setNudges((ps) => ps.filter((p) => p.taskId !== id))
  }

  // Coins are points: earned by finishing, spent on games. Never below zero.
  function spendPoints(n) {
    setPoints((p) => Math.max(0, p - n))
    return true
  }

  // Snoozing clears the task's nudges and holds the scheduler off for the chosen time (an hour by default).
  // It's free. The third snooze on the same task earns the joke crash screen.
  function snoozeTask(id, minutes = 60) {
    setNudges((ps) => ps.filter((p) => p.taskId !== id))
    updateTask(id, { snoozedUntil: new Date(Date.now() + minutes * 60000).toISOString(), snoozeMinutes: minutes })
    const count = (snoozes[id] ?? 0) + 1
    if (count < 3) say(snoozeLine(count > 1, name || 'friend', Date.now(), snoozeLabel(minutes)))
    setSnoozes((s) => ({ ...s, [id]: count >= 3 ? 0 : count }))
    if (count >= 3) setJoke({ taskId: id, key: Date.now() })
  }

  function reopenTask(id) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: false, proof: false } : t)))
  }

  function resetDemo() {
    setTasks([])
    setLastPlan(null)
    setNudges([])
    setPoints(0)
    setStreak(0)
    setStreakDay(null)
  }

  return (
    <StoreContext.Provider
      value={{
        name, setName, tasks, addTasks, completeTask, reopenTask, updateTask, deleteTask,
        nudges, setNudges, points, streak, setStreak,
        celebration, setCelebration, resetDemo, theme, setTheme, accents, setAccent,
        termsAcceptedAt, setTermsAcceptedAt, account, setAccount, signOut, hydrated, replaceTasks: setTasks, replacePoints: setPoints, spendPoints, aboutTaskId, setAboutTaskId,
        tutorialSeen, tutorialOpen, openTutorial, closeTutorial,
        schedule, setSchedule, introSeen, setIntroSeen, snoozeTask, joke, setJoke,
        buddy, setBuddy, say, voiceOn, setVoiceOn, soundAsked, setSoundAsked, voiceDeclined, setVoiceDeclined, permsLater, setPermsLater, micAsked, setMicAsked, alarmOn, setAlarmOn, alarmAsked, setAlarmAsked, musicOn, setMusicOn, ambient, setAmbient, volume, setVolume, muted, setMuted, badgeArt, setBadgeArt, mascotArt, setMascotArt, rundownMode, setRundownMode, nudgeModel, setNudgeModel, voiceName, setVoiceName, buddyName, setBuddyName, ambientAsked, setAmbientAsked, storyOpen, setStoryOpen, chat, addChat, lastPlan, setLastPlan,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  return useContext(StoreContext)
}
