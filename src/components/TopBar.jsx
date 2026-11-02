import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store.jsx'
import Mascot from './Mascot.jsx'
import ThemeSwitcher from './ThemeSwitcher.jsx'
import Counter from './Counter.jsx'
import SoundButton from './SoundButton.jsx'
import AccountMenu from './AccountMenu.jsx'
import { ChevronIcon, StarIcon } from './Icons.jsx'

export default function TopBar() {
  const { points, openTutorial, buddyName } = useStore()
  const { pathname, key } = useLocation()
  const navigate = useNavigate()
  // Every page except Today gets a back arrow; with nothing behind it (opened directly), it goes to Today.
  const canGoBack = pathname !== '/'
  return (
    <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-2 lg:max-w-5xl">
        {canGoBack && (
          <button
            type="button"
            onClick={() => (key !== 'default' ? navigate(-1) : navigate('/'))}
            aria-label="Back"
            className="-ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-bg shadow-btn"
          >
            <ChevronIcon size={22} className="rotate-90" />
          </button>
        )}
        <Link to="/" className="flex min-w-0 items-center gap-1.5">
          <Mascot size={28} />
          {/* On a phone the wordmark makes room for the back arrow. */}
          <span className={`max-w-[10rem] truncate font-display text-xl ${canGoBack ? 'hidden sm:inline' : ''}`}>{buddyName || 'Nudgy'}</span>
        </Link>
        <Link
          to="/rewards"
          className="ml-auto flex min-h-10 items-center gap-1.5 rounded-full border-[length:var(--bw)] border-line bg-surface px-3 text-sm font-semibold"
          aria-label={`${points} points`}
        >
          <StarIcon size={16} className="text-ink/50" /> <Counter value={points} />
        </Link>
        <button
          type="button"
          onClick={openTutorial}
          aria-label="How to use Nudgy"
          title="How to use Nudgy"
          className="hidden h-10 w-10 place-items-center rounded-full border-[length:var(--bw)] border-line bg-surface text-sm font-semibold text-ink/60 hover:text-ink sm:grid"
        >
          ?
        </button>
        {/* On phones the speaker takes the "?" spot; help lives on the Me page there. */}
        <SoundButton />
        <ThemeSwitcher />
        <AccountMenu />
      </div>
    </header>
  )
}
