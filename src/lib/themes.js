// Each theme is a Nudged personality. The look lives in index.css under [data-theme].
// accents: the main colour can be swapped within a theme. The first is the theme's own
// (what index.css sets); picking another overrides just these four variables.
export const THEMES = [
  {
    id: 'chill',
    name: 'Chill',
    vibe: 'Calm nudges, zero drama.',
    sample: (n) => `Hey ${n}, whenever you're ready: call mum. No rush. Ish.`,
    swatch: ['#2f7d62', '#9fd3b8', '#f3f6f4'],
    accents: [
      { id: 'green', name: 'Green', primary: '#2f7d62', primaryDark: '#22604a', onPrimary: '#ffffff', soft: '#e1eee7' },
      { id: 'teal', name: 'Teal', primary: '#0f766e', primaryDark: '#0b5d57', onPrimary: '#ffffff', soft: '#dff2ef' },
      { id: 'blue', name: 'Blue', primary: '#3b6ea8', primaryDark: '#2d5786', onPrimary: '#ffffff', soft: '#e3ecf6' },
      { id: 'clay', name: 'Clay', primary: '#b45f3c', primaryDark: '#924a2d', onPrimary: '#ffffff', soft: '#f6e7df' },
    ],
  },
  {
    id: 'cheeky',
    name: 'Cheeky',
    vibe: 'Warm, a little punny.',
    sample: (n) => `${n}, the groceries called. They miss you. Tonight?`,
    swatch: ['#5b4be8', '#f9c5dd', '#faf6f0'],
    accents: [
      { id: 'purple', name: 'Purple', primary: '#5b4be8', primaryDark: '#4637c9', onPrimary: '#ffffff', soft: '#fbe3ee' },
      { id: 'pink', name: 'Pink', primary: '#d6478a', primaryDark: '#b8336f', onPrimary: '#ffffff', soft: '#fbe3ee' },
      { id: 'teal', name: 'Teal', primary: '#0f8b8d', primaryDark: '#0b6f71', onPrimary: '#ffffff', soft: '#dcf1f1' },
      { id: 'coral', name: 'Coral', primary: '#e2583e', primaryDark: '#c4442c', onPrimary: '#ffffff', soft: '#fde5df' },
    ],
  },
  {
    id: 'sassy',
    name: 'Sassy',
    vibe: 'Loud, blocky, no chill.',
    sample: (n) => `${n}. The demo. Today. I will not be ignored.`,
    swatch: ['#1f3bff', '#ffe14d', '#f4f1ea'],
    accents: [
      { id: 'blue', name: 'Blue', primary: '#1f3bff', primaryDark: '#111111', onPrimary: '#ffffff', soft: '#e8e4da' },
      { id: 'coral', name: 'Coral', primary: '#ff4d2e', primaryDark: '#111111', onPrimary: '#ffffff', soft: '#e8e4da' },
      { id: 'green', name: 'Green', primary: '#00a35c', primaryDark: '#111111', onPrimary: '#ffffff', soft: '#e8e4da' },
      { id: 'black', name: 'Black', primary: '#111111', primaryDark: '#333333', onPrimary: '#ffffff', soft: '#e8e4da' },
    ],
  },
  {
    id: 'night',
    name: 'Night owl',
    vibe: 'Dark mode for 2 AM brain-dumps.',
    sample: (n) => `Still up, ${n}? Same. Let's knock one out.`,
    swatch: ['#c6f432', '#171b22', '#0e1116'],
    accents: [
      { id: 'lime', name: 'Lime', primary: '#c6f432', primaryDark: '#9cc41f', onPrimary: '#0e1116', soft: '#222936' },
      { id: 'violet', name: 'Violet', primary: '#a297ff', primaryDark: '#8b7bff', onPrimary: '#0e1116', soft: '#222936' },
      { id: 'amber', name: 'Amber', primary: '#f2b84b', primaryDark: '#d99a2b', onPrimary: '#0e1116', soft: '#222936' },
      { id: 'cyan', name: 'Cyan', primary: '#4dd4e6', primaryDark: '#2fb5c7', onPrimary: '#0e1116', soft: '#222936' },
    ],
  },
]

// Sets (or clears, for the theme's own colour) the CSS variables for the picked accent.
export function applyAccent(themeId, accentId) {
  const theme = THEMES.find((t) => t.id === themeId)
  const accent = theme?.accents.find((a) => a.id === accentId)
  const root = document.documentElement.style
  const vars = { '--primary': 'primary', '--primary-dark': 'primaryDark', '--on-primary': 'onPrimary', '--soft': 'soft' }
  for (const [cssVar, key] of Object.entries(vars)) {
    if (!accent || accent === theme.accents[0]) root.removeProperty(cssVar)
    else root.setProperty(cssVar, accent[key])
  }
}
