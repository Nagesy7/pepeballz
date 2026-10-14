// Coat palettes copied from Inu Verse (src/game.js) so PepeBallz Inu match the Verse look.
export const COATS = {
  tan:    { name: 'Classic Tan',    base: '#d98b45', dark: '#a8622c', light: '#f7e6c8', ear: '#f0b48e' },
  cream:  { name: 'Cream / White',  base: '#efe4cf', dark: '#c9b79a', light: '#fffaf0', ear: '#f3c6b0' },
  red:    { name: 'Reddish-Brown',  base: '#b4532b', dark: '#7f351a', light: '#f3d9bf', ear: '#e59a7c' },
  dark:   { name: 'Dark Brown',     base: '#4b3529', dark: '#2d1f18', light: '#8c6b52', ear: '#7a5644' },
  golden: { name: 'Light Golden',   base: '#e9b75c', dark: '#bf8a36', light: '#fcf0d4', ear: '#f4c79a' },
  gray:   { name: 'Gray',           base: '#a4a7ad', dark: '#73777e', light: '#ececee', ear: '#d6b3b0' },
};
const COAT_ALIASES = { sesame: 'tan', black: 'dark' };
export const normalizeCoat = (c) => (COATS[c] ? c : COATS[COAT_ALIASES[c]] ? COAT_ALIASES[c] : 'tan');
