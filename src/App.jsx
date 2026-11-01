import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from './lib/store.jsx'
import TopBar from './components/TopBar.jsx'
import ThemeSwitcher from './components/ThemeSwitcher.jsx'
import Nav from './components/Nav.jsx'
import Celebration from './components/Celebration.jsx'
import Tutorial from './components/Tutorial.jsx'
import Intro from './components/Intro.jsx'
import Joke from './components/Joke.jsx'
import Buddy from './components/Buddy.jsx'
import NudgeScheduler from './components/NudgeScheduler.jsx'
import ModelTag from './components/ModelTag.jsx'
import Permissions from './components/Permissions.jsx'
import AmbientPlayer from './components/AmbientPlayer.jsx'
import OnboardingPage from './pages/OnboardingPage.jsx'
import HomePage from './pages/HomePage.jsx'
import NudgesPage from './pages/NudgesPage.jsx'
import ProofPage from './pages/ProofPage.jsx'
import RewardsPage from './pages/RewardsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import PlayPage from './pages/PlayPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import LoginPage from './pages/LoginPage.jsx'

function Page({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  )
}

export default function App() {
  const { name, account, termsAcceptedAt, introSeen, setIntroSeen } = useStore()
  const location = useLocation()
  // Welcome and login are the only pages open to everyone.
  const onboarding = location.pathname === '/welcome' || location.pathname === '/login'

  // Everything else needs an account. Logged out: welcome. Logged in but no name or terms yet: those steps on /login.
  if (!account && !onboarding) return <Navigate to="/welcome" replace />
  if (account && (!name || !termsAcceptedAt) && !onboarding) return <Navigate to="/login" replace />
  // Already in: the welcome page isn't for you.
  if (account && name && location.pathname === '/welcome') return <Navigate to="/" replace />

  return (
    <>
      {onboarding ? (
        <div className="fixed right-4 top-3 z-40"><ThemeSwitcher /></div>
      ) : (
        <TopBar />
      )}

      {/* Home gets a right rail on wide screens; the other pages stay a single column. */}
      <main className={`mx-auto px-4 pt-1 pb-24 ${location.pathname === '/' ? 'max-w-xl lg:max-w-5xl' : location.pathname === '/welcome' ? 'max-w-5xl' : 'max-w-xl'}`}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/welcome" element={<Page><OnboardingPage /></Page>} />
            <Route path="/login" element={<Page><LoginPage /></Page>} />
            <Route path="/" element={<Page><HomePage /></Page>} />
            <Route path="/nudges" element={<Page><NudgesPage /></Page>} />
            <Route path="/proof/:id" element={<Page><ProofPage /></Page>} />
            <Route path="/rewards" element={<Page><RewardsPage /></Page>} />
            <Route path="/settings" element={<Page><SettingsPage /></Page>} />
            <Route path="/play" element={<Page><PlayPage /></Page>} />
            <Route path="/history" element={<Page><HistoryPage /></Page>} />
            <Route path="*" element={<Page><NotFoundPage /></Page>} />
          </Routes>
        </AnimatePresence>
      </main>

      {!onboarding && <Nav />}
      {!onboarding && <NudgeScheduler />}
      <AmbientPlayer />
      <ModelTag />
      <Celebration />
      <Tutorial />
      <Joke />
      <Buddy />
      {!introSeen && <Intro onDone={() => setIntroSeen(true)} />}
      {/* After the intro, outside the welcome/login screens: ask for sound, notifications and mic. */}
      {introSeen && !onboarding && <Permissions />}
    </>
  )
}
