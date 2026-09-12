export interface DownloadRecord {
  filename: string;
  blob: Blob;
  at: number;
}

const recent: DownloadRecord[] = [];

/** Last few downloads started by the app (newest last). Used by the devtools surface and E2E on WebKit. */
export function recentDownloads(): readonly DownloadRecord[] {
  return recent;
}

/** Real browser download of a Blob with the correct filename/type. */
export function downloadBlob(blob: Blob, filename: string): void {
  recent.push({ filename, blob, at: Date.now() });
  if (recent.length > 10) recent.shift();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser time to start the download before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
