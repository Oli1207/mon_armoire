const MAX_SIDE = 2400;
const LIGHT_ENOUGH = 4 * 1024 * 1024;
const WEB_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const toBlob = (canvas, type, quality) => new Promise((resolve) => { canvas.toBlob(resolve, type, quality); });

/**
 * Réduit dans le navigateur une photo lourde ou trop grande avant son envoi : plus rapide en 3G/4G, et plus léger
 * pour le serveur mutualisé. Si le navigateur ne sait pas la lire (HEIC sous Chrome…), le fichier part tel quel :
 * le serveur sait le convertir.
 */
export async function prepareImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= LIGHT_ENOUGH && WEB_TYPES.includes(file.type)) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    let blob = await toBlob(canvas, 'image/webp', 0.9);
    if (blob?.type !== 'image/webp') { // Safari n'encode pas le WebP : JPEG, sans transparence
      context.globalCompositeOperation = 'destination-over';
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      blob = await toBlob(canvas, 'image/jpeg', 0.9);
    }
    if (!blob) return file;
    const stem = file.name.replace(/\.[^.]*$/, '') || 'photo';
    return new File([blob], `${stem}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`, { type: blob.type });
  } catch {
    return file;
  }
}
