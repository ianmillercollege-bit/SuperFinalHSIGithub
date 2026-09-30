export const AVATAR = { types: ['image/png', 'image/jpeg', 'image/webp'], maxBytes: 5 * 1024 * 1024, size: 256, maxDataUrl: 120_000 } as const;
export class AvatarError extends Error {}

// Validates the file, crops it to a centered square, shrinks it to 256x256, and returns a small JPEG data URL.
// SVG and other types are refused on purpose (SVG can carry scripts). Nothing is uploaded anywhere.
export async function processAvatar(file: File): Promise<string> {
  if (!(AVATAR.types as readonly string[]).includes(file.type)) throw new AvatarError('Use a PNG, JPEG or WebP image.');
  if (file.size > AVATAR.maxBytes) throw new AvatarError('That image is over 5 MB. Choose a smaller one.');
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new AvatarError("We couldn't read that image. Try another file."); }
  try {
    const side = Math.min(bmp.width, bmp.height);
    if (side < 1) throw new AvatarError("We couldn't read that image. Try another file.");
    const c = document.createElement('canvas'); c.width = c.height = AVATAR.size;
    const g = c.getContext('2d'); if (!g) throw new AvatarError('Your browser cannot process images.');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, AVATAR.size, AVATAR.size);
    g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, AVATAR.size, AVATAR.size);
    for (const q of [0.86, 0.72, 0.6, 0.45]) { const url = c.toDataURL('image/jpeg', q); if (url.length <= AVATAR.maxDataUrl) return url; }
    throw new AvatarError('That image is too detailed to store. Try a simpler one.');
  } finally { bmp.close?.(); }
}
