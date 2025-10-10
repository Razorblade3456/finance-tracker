type Hostname = string;

/**
 * Default client ID that works for the local development environment.
 * Update the map below or provide environment variables for production
 * deployments (see README for details).
 */
const LOCAL_GOOGLE_CLIENT_ID = '79775733699-m2t6l70fngeo69s4qjo5pmnoqo8enccm.apps.googleusercontent.com';

const FALLBACK_CLIENT_IDS_BY_HOST: Record<Hostname, string> = {
  /**
   * Localhost when running `npm run dev`.
   */
  'localhost:5173': LOCAL_GOOGLE_CLIENT_ID
};

const parseHostMapFromEnv = () => {
  const raw = import.meta.env.VITE_GOOGLE_CLIENT_ID_MAP;
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<Hostname, string> | null;
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (error) {
    console.warn(
      'Unable to parse VITE_GOOGLE_CLIENT_ID_MAP. Provide JSON such as {"your-site.netlify.app":"oauth-client-id"}.',
      error
    );
  }

  return null;
};

const getHostKey = (hostname?: string) => hostname?.toLowerCase().replace(/^https?:\/\//, '') ?? '';

const deriveHostCandidates = (hostname?: string): string[] => {
  const hostKey = getHostKey(hostname).replace(/:\d+$/, '');

  if (!hostKey) {
    return [];
  }

  const candidates = new Set<string>([hostKey]);

  const netlifyBranchMatch = hostKey.match(/^.+?--(.+\.netlify\.app)$/);
  if (netlifyBranchMatch) {
    candidates.add(netlifyBranchMatch[1]);
  }

  const labels = hostKey.split('.');
  for (let i = 1; i < labels.length - 1; i += 1) {
    const candidate = labels.slice(i).join('.');
    if (candidate) {
      candidates.add(candidate);
    }
  }

  return Array.from(candidates);
};

export const resolveGoogleClientId = (hostname?: string) => {
  const explicitClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
  if (explicitClientId) {
    return explicitClientId;
  }

  const mapFromEnv = parseHostMapFromEnv();
  const combinedMap = mapFromEnv ? { ...FALLBACK_CLIENT_IDS_BY_HOST, ...mapFromEnv } : FALLBACK_CLIENT_IDS_BY_HOST;

  const hostCandidates = deriveHostCandidates(hostname);
  const clientId = hostCandidates.map((candidate) => combinedMap[candidate]).find((value) => Boolean(value));

  return clientId?.trim() ?? '';
};


