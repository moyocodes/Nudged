import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { useStore } from '../lib/store.jsx'

// Nudged: a smiling blob that nudges you with its elbow. Colours come from the active theme;
// idle wiggle, blinking and nudging are GSAP timelines.
const fill = (v) => ({ fill: `var(${v})` })
const line = (v) => ({ stroke: `var(${v})` })
// Shades mixed from the theme's mascot colour, so every theme gets a matching belly, feet and shadow.
const LIGHT = 'color-mix(in srgb, var(--mascot) 55%, white)'
const DARK = 'color-mix(in srgb, var(--mascot) 75%, var(--mascot-line))'
const CHEEK = '#ff7a93'

// Nudged in the look from Restyle Nudged. A picture has no mouth to move, so it bounces while talking.
function ArtMascot({ src, size, nudging, wiggle, talking }) {
  const root = useRef(null)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      if (talking) gsap.to(root.current, { y: -size * 0.06, scaleY: 1.03, transformOrigin: '50% 100%', duration: 0.16, yoyo: true, repeat: -1, ease: 'sine.inOut' })
      else if (nudging) gsap.timeline({ repeat: -1, repeatDelay: 0.8 }).to(root.current, { rotate: 7, transformOrigin: '50% 100%', duration: 0.12, ease: 'power2.in' }).to(root.current, { rotate: 0, duration: 0.5, ease: 'elastic.out(1.2, 0.4)' })
      else if (wiggle) gsap.fromTo(root.current, { rotate: -5 }, { rotate: 5, transformOrigin: '50% 90%', duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    }, root)
    return () => ctx.revert()
  }, [talking, nudging, wiggle, size])
  return <img ref={root} src={src} width={size} height={size} alt="Nudged" className="object-contain" />
}

export default function Mascot(props) {
  const { mascotArt } = useStore()
  const { size = 96, nudging = false, wiggle = false, talking = false } = props
  if (mascotArt) return <ArtMascot src={mascotArt} size={size} nudging={nudging} wiggle={wiggle} talking={talking} />
  return <DrawnMascot size={size} nudging={nudging} wiggle={wiggle} talking={talking} />
}

function DrawnMascot({ size, nudging, wiggle, talking }) {
  const root = useRef(null)
  const body = useRef(null)
  const arm = useRef(null)
  const eyes = useRef(null)
  const mouth = useRef(null)

  // Talking: the mouth opens and closes at a speech-ish rhythm.
  useEffect(() => {
    if (!talking || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const tween = gsap.to(mouth.current, {
      scaleY: 2.6, transformOrigin: '50% 0%', duration: 0.11, yoyo: true, repeat: -1, ease: 'sine.inOut',
      repeatRefresh: true,
    })
    return () => {
      tween.kill()
      gsap.set(mouth.current, { scaleY: 1 })
    }
  }, [talking])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.to(eyes.current, {
        scaleY: 0.1, transformOrigin: '50% 50%', duration: 0.08, yoyo: true, repeat: 1,
        repeatDelay: 0.05, delay: 2, ease: 'power1.inOut',
        onComplete() { this.delay(2 + Math.random() * 3).restart(true) },
      })
      if (wiggle) {
        gsap.fromTo(root.current, { rotate: -5 }, { rotate: 5, transformOrigin: '50% 90%', duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
      }
      if (nudging) {
        gsap.timeline({ repeat: -1, repeatDelay: 0.6 })
          .to(arm.current, { x: 14, duration: 0.12, ease: 'power2.in' })
          .to(body.current, { rotate: 6, transformOrigin: '50% 100%', duration: 0.12, ease: 'power2.in' }, '<')
          .to([arm.current, body.current], { x: 0, rotate: 0, duration: 0.5, ease: 'elastic.out(1.2, 0.4)' })
          .to(arm.current, { x: 14, duration: 0.12, ease: 'power2.in' })
          .to(body.current, { rotate: 6, duration: 0.12, ease: 'power2.in' }, '<')
          .to([arm.current, body.current], { x: 0, rotate: 0, duration: 0.5, ease: 'elastic.out(1.2, 0.4)' })
      }
    }, root)
    return () => ctx.revert()
  }, [nudging, wiggle])

  return (
    <svg ref={root} width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Nudged, a friendly blob nudging with its elbow" className="shrink-0 overflow-visible">
      <ellipse cx="52" cy="111" rx="30" ry="4" style={fill('--mascot-line')} opacity=".12" />
      <g ref={body}>
        <g ref={arm}>
          <path d="M78 60l22 10-10 16" style={line('--mascot-line')} strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M78 60l22 10-10 16" style={{ stroke: 'var(--mascot)' }} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
        <ellipse cx="40" cy="105" rx="9" ry="5" style={{ fill: DARK, ...line('--mascot-line') }} strokeWidth="3" />
        <ellipse cx="64" cy="105" rx="9" ry="5" style={{ fill: DARK, ...line('--mascot-line') }} strokeWidth="3" />
        <path d="M52 24c24 0 34 21 34 46s-14 35-34 35-34-10-34-35 10-46 34-46z" style={{ ...fill('--mascot'), ...line('--mascot-line') }} strokeWidth="3" />
        <ellipse cx="52" cy="86" rx="19" ry="14" style={{ fill: LIGHT }} />
        <path d="M30 50c3-9 9-14 16-16" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".7" fill="none" />
        <ellipse cx="33" cy="72" rx="5.5" ry="3.2" style={{ fill: CHEEK }} opacity=".55" />
        <ellipse cx="71" cy="72" rx="5.5" ry="3.2" style={{ fill: CHEEK }} opacity=".55" />
        <g ref={eyes}>
          <circle cx="42" cy="62" r="4.5" style={fill('--mascot-face')} />
          <circle cx="62" cy="62" r="4.5" style={fill('--mascot-face')} />
          <circle cx="43.6" cy="60.4" r="1.4" fill="#fff" />
          <circle cx="63.6" cy="60.4" r="1.4" fill="#fff" />
        </g>
        <path ref={mouth} d="M46 72c4 5 8 5 12 0" style={line('--mascot-face')} strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
      <path d="M100 18l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" style={fill('--highlight')} />
    </svg>
  )
}
