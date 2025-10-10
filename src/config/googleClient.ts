type Hostname = string;

/**
 * Default client ID that works for the local development environment.
 * Update the map below or provide environment variables for production
 * deployments (see README for details).
 */
const LOCAL_GOOGLE_CLIENT_ID = '79775733699-m2t6l70fngeo69s4qjo5pmnoqo8enccm.apps.googleusercontent.com';

const getHostKey = (hostname?: string) => hostname?.toLowerCase().replace(/^https?:\/\//, '') ?? '';

const stripPort = (hostname?: string) => hostname?.replace(/:\d+$/, '') ?? '';

const normalizeHostMapKeys = (map: Record<Hostname, string>) => {
  const normalized: Record<Hostname, string> = {};

  Object.entries(map).forEach(([rawKey, rawValue]) => {
    if (typeof rawValue !== 'string') {
      return;
    }

    const value = rawValue.trim();
    if (!value) {
      return;
    }

    const trimmedKey = rawKey.trim();
    if (!trimmedKey) {
      return;
    }

    const hostWithPort = getHostKey(trimmedKey);
    const hostWithoutPort = stripPort(hostWithPort);

    if (hostWithPort) {
      normalized[hostWithPort] = value;
    }

    if (hostWithoutPort) {
      normalized[hostWithoutPort] = value;
    }
  });

  return normalized;
};

const FALLBACK_CLIENT_IDS_BY_HOST = normalizeHostMapKeys({
  /**
   * Localhost when running `npm run dev`.
   */
  'localhost:5173': LOCAL_GOOGLE_CLIENT_ID
});

const parseHostMapFromEnv = () => {
  const raw = import.meta.env.VITE_GOOGLE_CLIENT_ID_MAP;
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<Hostname, string> | null;
    if (parsed && typeof parsed === 'object') {
      return normalizeHostMapKeys(parsed);
    }
  } catch (error) {
    console.warn(
      'Unable to parse VITE_GOOGLE_CLIENT_ID_MAP. Provide JSON such as {"your-site.netlify.app":"oauth-client-id"}.',
      error
    );
  }

  return null;
};

const deriveHostCandidates = (hostname?: string): string[] => {
  const hostKey = stripPort(getHostKey(hostname));

  if (!hostKey) {
    return [];
  }

  const candidates = new Set<string>([
    hostKey,
    getHostKey(hostname),
    hostname ?? '',
    stripPort(hostname)
  ]);

  const addProtocolVariants = (baseHost: string) => {
    if (!baseHost) {
      return;
    }

    candidates.add(`https://${baseHost}`);
    candidates.add(`https://${baseHost}/`);
    candidates.add(`http://${baseHost}`);
    candidates.add(`http://${baseHost}/`);
  };

  addProtocolVariants(hostKey);

  const netlifyBranchMatch = hostKey.match(/^.+?--(.+\.netlify\.app)$/);
  if (netlifyBranchMatch) {
    const baseHost = netlifyBranchMatch[1];
    candidates.add(baseHost);
    addProtocolVariants(baseHost);
  }

  const labels = hostKey.split('.');
  for (let i = 1; i < labels.length - 1; i += 1) {
    const candidate = labels.slice(i).join('.');
    if (candidate) {
      candidates.add(candidate);
      addProtocolVariants(candidate);
    }
  }

  return Array.from(candidates).filter(Boolean);
};

export const resolveGoogleClientId = (hostname?: string) => {
  const explicitClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
  if (explicitClientId) {
    return explicitClientId;
  }

  const mapFromEnv = parseHostMapFromEnv();
  const combinedMap = mapFromEnv
    ? { ...FALLBACK_CLIENT_IDS_BY_HOST, ...normalizeHostMapKeys(mapFromEnv) }
    : FALLBACK_CLIENT_IDS_BY_HOST;

  const hostCandidates = deriveHostCandidates(hostname);
  const clientId = hostCandidates.map((candidate) => combinedMap[candidate]).find((value) => Boolean(value));

  return clientId?.trim() ?? '';
};


