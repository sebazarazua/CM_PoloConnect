export default function inspect({
  safeTop,
  safeBottom,
  width,
  height,
  logoWidth,
  logoHeight,
}) {
  const issues = [],
    scale = width / 1080;
  const luminance = (hex) => {
    const rgb = hex.startsWith("#")
      ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
      : (hex.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const values = rgb.map((n) => {
      const c = n / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
  };
  let minContrast = 100;
  const elements = [...document.querySelectorAll('[data-check="text"]')];
  for (const el of elements) {
    const r = el.getBoundingClientRect(),
      range = document.createRange();
    range.selectNodeContents(el);
    const lines = [...range.getClientRects()];
    if (
      r.left < 38 * scale ||
      r.right > width - 38 * scale ||
      r.top < 0 ||
      r.bottom > height
    )
      issues.push("Text outside art bounds: " + el.textContent.slice(0, 40));
    if (
      el.scrollWidth > el.clientWidth + 3 ||
      el.scrollHeight > el.clientHeight + 5 ||
      lines.some(
        (line) =>
          line.right > r.right + 4 ||
          line.bottom > r.bottom + 6 ||
          line.left < r.left - 4,
      )
    )
      issues.push("Text overflow: " + el.textContent.slice(0, 45));
    if (
      el.closest("[data-critical]") &&
      (r.top < safeTop * scale || r.bottom > height - safeBottom * scale)
    )
      issues.push("Critical text outside surface safe area");
    const a = luminance(getComputedStyle(el).color),
      b = luminance(el.dataset.bg);
    const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    minContrast = Math.min(minContrast, contrast);
    if (contrast < 4.5)
      issues.push("Contrast below 4.5: " + el.textContent.slice(0, 32));
  }
  const logo = document.querySelector("[data-logo]"),
    rect = logo.getBoundingClientRect(),
    logoRatio = rect.width / rect.height;
  if (Math.abs(logoRatio - logoWidth / logoHeight) > 0.01)
    issues.push("Logo aspect ratio distorted");
  if (
    !document.fonts.check("700 30px Display") ||
    !document.fonts.check("400 30px Barlow")
  )
    issues.push("Editorial font missing");
  for (let i = 0; i < elements.length; i++)
    for (let j = i + 1; j < elements.length; j++) {
      const a = elements[i],
        b = elements[j];
      if (a.contains(b) || b.contains(a)) continue;
      const x = a.getBoundingClientRect(),
        y = b.getBoundingClientRect();
      if (
        Math.min(x.right, y.right) - Math.max(x.left, y.left) > 4 &&
        Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 4
      )
        issues.push(
          "Text collision: " +
            a.textContent.slice(0, 20) +
            " / " +
            b.textContent.slice(0, 20),
        );
    }
  const photo = document.querySelector("[data-photo]");
  return {
    issues,
    textElements: elements.length,
    minContrast,
    logoRatio,
    photo: photo
      ? {
          width: photo.naturalWidth,
          height: photo.naturalHeight,
          boxWidth: photo.clientWidth,
          boxHeight: photo.clientHeight,
        }
      : null,
  };
}
