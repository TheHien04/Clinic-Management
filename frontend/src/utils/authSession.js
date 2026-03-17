import { STORAGE_KEYS } from '../constants';

export function hasValidSession() {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  const userRaw = localStorage.getItem(STORAGE_KEYS.USER);

  if (!token || !userRaw) {
    return false;
  }

  try {
    const parsed = JSON.parse(userRaw);
    return Boolean(parsed && parsed.email);
  } catch {
    return false;
  }
}
