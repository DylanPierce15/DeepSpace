// Note definitions for 2 octaves (C4 to B5)
export const NOTES = [
  { note: 60, name: 'C4', isBlack: false, key: 'a' },
  { note: 61, name: 'C#4', isBlack: true, key: 'w' },
  { note: 62, name: 'D4', isBlack: false, key: 's' },
  { note: 63, name: 'D#4', isBlack: true, key: 'e' },
  { note: 64, name: 'E4', isBlack: false, key: 'd' },
  { note: 65, name: 'F4', isBlack: false, key: 'f' },
  { note: 66, name: 'F#4', isBlack: true, key: 't' },
  { note: 67, name: 'G4', isBlack: false, key: 'g' },
  { note: 68, name: 'G#4', isBlack: true, key: 'y' },
  { note: 69, name: 'A4', isBlack: false, key: 'h' },
  { note: 70, name: 'A#4', isBlack: true, key: 'u' },
  { note: 71, name: 'B4', isBlack: false, key: 'j' },
  { note: 72, name: 'C5', isBlack: false, key: 'k' },
  { note: 73, name: 'C#5', isBlack: true, key: 'o' },
  { note: 74, name: 'D5', isBlack: false, key: 'l' },
  { note: 75, name: 'D#5', isBlack: true, key: 'p' },
  { note: 76, name: 'E5', isBlack: false, key: ';' },
  { note: 77, name: 'F5', isBlack: false, key: '\'' },
  { note: 78, name: 'F#5', isBlack: true, key: ']' },
  { note: 79, name: 'G5', isBlack: false, key: 'z' },
  { note: 80, name: 'G#5', isBlack: true, key: 'x' },
  { note: 81, name: 'A5', isBlack: false, key: 'c' },
  { note: 82, name: 'A#5', isBlack: true, key: 'v' },
  { note: 83, name: 'B5', isBlack: false, key: 'b' }
];

// Natural/Organic color palette - darker earth tones
export const COLORS = {
  sage: '#5a7353', // Deep forest green
  sageLight: '#6d8765',
  sageDark: '#475a42',
  terracotta: '#b05a3c', // Burnt terracotta
  terracottaLight: '#c97456',
  warmBrown: '#6b5434', // Rich brown
  warmBrownLight: '#8b6f47',
  bg: '#2d2620', // Deep warm brown background
  bgLight: '#3d362f',
  cardBg: '#4a4239', // Warm dark card background
  cream: '#c9b99a', // Warm beige
  creamDark: '#a89978',
  text: {
    primary: '#e8dcc9', // Light cream for text
    secondary: '#c9b99a',
    tertiary: '#a89978'
  },
  white: '#fdfcfa',
  shadow: 'rgba(0, 0, 0, 0.3)' // Deeper shadow
};
