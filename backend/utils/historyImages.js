/** Accept a single data-URL image or a JSON array of data-URL images. */
function validHistoryImageField(value) {
  if (value == null || value === '') return null;
  const s = String(value);
  if (s.startsWith('data:image')) return s;
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      if (
        Array.isArray(arr)
        && arr.length > 0
        && arr.every((x) => x && String(x).startsWith('data:image'))
      ) {
        return s;
      }
    } catch {
      /* invalid JSON */
    }
  }
  return null;
}

module.exports = { validHistoryImageField };
