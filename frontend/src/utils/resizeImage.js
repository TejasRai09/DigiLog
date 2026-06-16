/** Resize image to max 900px JPEG data URL for equipment photo uploads. */
export function resizeImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
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
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
