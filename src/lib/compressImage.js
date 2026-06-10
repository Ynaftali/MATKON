/**
 * Compress an image File to a max width/height and JPEG quality.
 * Returns a new File ready for upload.
 */
export async function compressImage(file, { maxPx = 1200, quality = 0.78 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { naturalWidth: w, naturalHeight: h } = img
      const scale  = Math.min(1, maxPx / Math.max(w, h))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        blob => {
          if (!blob) { reject(new Error('compression failed')); return }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = reject
    img.src = url
  })
}
