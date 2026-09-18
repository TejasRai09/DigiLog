/** Resize image to max 900px JPEG data URL for equipment photo uploads. */
export function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const fail = (err) => {
      reject(err instanceof Error ? err : new Error('Could not read image.'));
    };

    const reader = new FileReader();
    reader.onerror = () => fail(reader.error || new Error('Could not read image.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          let { width: w, height: h } = img;
          if (w > 900 || h > 900) {
            if (w > h) {
              h = Math.round((h * 900) / w);
              w = 900;
            } else {
              w = Math.round((w * 900) / h);
              h = 900;
            }
          }
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', 0.75));
        } catch (err) {
          fail(err);
        }
      };
      img.onerror = () => fail(new Error('Could not decode image.'));
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
