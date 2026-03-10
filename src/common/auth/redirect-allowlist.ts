import { URL } from 'url';

type AllowedRedirect =
  | { type: 'scheme'; value: string }
  | { type: 'https-host'; value: string };

function parseList(envValue: string | undefined): AllowedRedirect[] {
  if (!envValue) return [];
  const raw = envValue
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const out: AllowedRedirect[] = [];
  for (const entry of raw) {
    // Accept either:
    // - "scheme:sudoku3dlayer" (matches sudoku3dlayer://...)
    // - "https:example.com" (matches https://example.com/...)
    const idx = entry.indexOf(':');
    if (idx <= 0) continue;
    const kind = entry.slice(0, idx);
    const value = entry.slice(idx + 1);
    if (!value) continue;

    if (kind === 'scheme') out.push({ type: 'scheme', value });
    if (kind === 'https') out.push({ type: 'https-host', value });
  }
  return out;
}

export function isAllowedRedirectUrl(
  redirectUrl: string,
  opts: {
    allowedListEnv?: string;
    fallbackScheme?: string;
  } = {},
): boolean {
  let url: URL;
  try {
    url = new URL(redirectUrl);
  } catch {
    return false;
  }

  const allowed = parseList(opts.allowedListEnv);
  const fallbackScheme = opts.fallbackScheme;

  if (url.protocol === 'https:') {
    return allowed.some(
      (a) =>
        a.type === 'https-host' &&
        a.value.toLowerCase() === url.host.toLowerCase(),
    );
  }

  // Custom app schemes are protocol like "sudoku3dlayer:".
  const scheme = url.protocol.replace(':', '');
  if (scheme && (fallbackScheme ? scheme === fallbackScheme : false)) {
    return true;
  }
  return allowed.some((a) => a.type === 'scheme' && a.value === scheme);
}
