// Original 5x7 pixel font (caps, digits, punctuation). Rendered crisp, cached per string+colour.
const G = {
  A: '0E11111F111111', B: '1E11111E11111E', C: '0E11101010110E', D: '1E11111111111E', E: '1F10101E10101F', F: '1F10101E101010', G: '0E11101711110F', H: '1111111F111111',
  I: '0E04040404040E', J: '0702020202120C', K: '11121418141211', L: '1010101010101F', M: '111B1515111111', N: '11111915131111', O: '0E11111111110E', P: '1E11111E101010',
  Q: '0E11111115120D', R: '1E11111E141211', S: '0F10100E01011E', T: '1F040404040404', U: '1111111111110E', V: '1111111111 0A04'.replace(' ', ''), W: '1111111515150A', X: '11110A040A1111',
  Y: '1111110A040404', Z: '1F01020408101F', 0: '0E111315191 10E'.replace(' ', ''), 1: '040C040404040E', 2: '0E11010204081F', 3: '1F02040201110E', 4: '02060A121F0202', 5: '1F101E0101110E',
  6: '0608101E11110E', 7: '1F010204080808', 8: '0E11110E11110E', 9: '0E11110F01020C', '.': '0000000000 0C0C'.replace(' ', ''), ',': '00000000 0C0408'.replace(' ', ''), '!': '04040404040004', '?': '0E110102040004',
  ':': '000C0C000C0C00', ';': '000C0C000C0408', '-': '0000001F000000', '+': '0004041F040400', '/': '01010204081010', "'": '0C040800000000', '"': '0A0A0A00000000', '(': '02040808080402',
  ')': '08040202020408', '%': '18190204081303', '#': '0A0A1F0A1F0A0A', '<': '02040810080402', '>': '08040201020408', '=': '00001F001F0000', '[': '0E08080808080E', ']': '0E02020202020E',
  _: '0000000000001F', '*': '0004150E150400', '&': '0C121408151 20D'.replace(' ', ''), $: '040F140E051E04', '@': '0E11171517100F', ' ': '00000000000000', '|': '04040404040404', '~': '00000D16000000', '…': '00000000000015',
};
const rows = {}; for (const k in G) { const h = G[k]; rows[k] = Array.from({ length: 7 }, (_, i) => parseInt(h.substr(i * 2, 2), 16)); }
export const CW = 6, CH = 8;
const cache = new Map();
function render(str, col) {
  const s = str.toUpperCase(), cv = document.createElement('canvas'); cv.width = Math.max(1, s.length * CW); cv.height = CH; const g = cv.getContext('2d'); g.fillStyle = col;
  for (let i = 0; i < s.length; i++) { const r = rows[s[i]] || rows['?']; for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) if (r[y] & (16 >> x)) g.fillRect(i * CW + x, y, 1, 1); }
  return cv;
}
export const measure = (s, scale = 1) => s.length * CW * scale;
export function drawText(ctx, str, x, y, col = '#fff', scale = 1, align = 'left', shadow = '#1a1420', outline = false) {
  str = String(str); const key = str + '|' + col; let cv = cache.get(key); if (!cv) { cv = render(str, col); cache.set(key, cv); if (cache.size > 800) cache.delete(cache.keys().next().value); }
  const w = cv.width * scale; let ox = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x); const oy = Math.round(y);
  if (shadow) { const sk = str + '|' + shadow; let sc = cache.get(sk); if (!sc) { sc = render(str, shadow); cache.set(sk, sc); }
    if (outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1], [0, 2], [1, 2], [-1, 2]]) ctx.drawImage(sc, ox + dx * Math.ceil(scale / 2), oy + dy * Math.ceil(scale / 2), w, CH * scale);
    else ctx.drawImage(sc, ox + scale, oy + scale, w, CH * scale); }
  ctx.drawImage(cv, ox, oy, w, CH * scale);
}
