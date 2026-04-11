const LOWER_ALPHA = "abcdefghijklmnopqrstuvwxyz";

/** Random `xxxxxxxxxx.pdf` (10 letters) for storage and table display. */
export function randomPdfStorageFileName(): string {
  const buf = new Uint8Array(10);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < 10; i++) {
    s += LOWER_ALPHA[buf[i]! % 26];
  }
  return `${s}.pdf`;
}
