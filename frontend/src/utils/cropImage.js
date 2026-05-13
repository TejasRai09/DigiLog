/** Build a cropped square JPEG blob from an image URL and react-easy-crop pixel rect. */

function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (e) => reject(e));
    if (!String(url).startsWith('blob:')) {
      image.setAttribute('crossOrigin', 'anonymous');
    }
    image.src = url;
  });
}

/**
 * @param {string} imageSrc Object URL or data URL
 * @param {{ x: number; y: number; width: number; height: number }} pixelCrop
 * @param {number} outputSize square edge in px (smaller helps stay under upload limit)
 * @param {number} quality jpeg 0–1
 */
export async function getCroppedImgBlob(imageSrc, pixelCrop, outputSize = 384, quality = 0.88) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas context');

  canvas.width = outputSize;
  canvas.height = outputSize;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Could not create image.'));
        else resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}
