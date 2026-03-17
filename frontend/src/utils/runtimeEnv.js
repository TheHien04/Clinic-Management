const DEFAULT_DEV_API_URL = 'http://localhost:5055/api';

const isProdBuild = () => Boolean(import.meta.env.PROD);

export const getApiBaseUrl = () => {
  const configured = String(import.meta.env.VITE_API_URL || '').trim();
  if (configured) {
    return configured;
  }

  if (isProdBuild()) {
    throw new Error('Missing VITE_API_URL for production build.');
  }

  return DEFAULT_DEV_API_URL;
};

export const getSocketBaseUrl = () => {
  const configured = String(import.meta.env.VITE_SOCKET_URL || '').trim();
  if (configured) {
    return configured;
  }

  const apiBaseUrl = getApiBaseUrl();
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    if (isProdBuild()) {
      throw new Error('Invalid VITE_API_URL. Unable to derive VITE_SOCKET_URL in production.');
    }
    return 'http://localhost:5055';
  }
};
