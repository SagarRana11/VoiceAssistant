import { UserProfile } from '../store/profileStore';

const BASE = '/api/profile';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('va_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchProfile(): Promise<UserProfile> {
  const res = await fetch(BASE, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data.profile as UserProfile;
}

export async function saveProfile(
  updates: Partial<UserProfile>
): Promise<UserProfile> {
  const res = await fetch(BASE, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data.profile as UserProfile;
}

export async function saveProfileField(
  field: string,
  value: unknown
): Promise<UserProfile> {
  return saveProfile({ [field]: value } as Partial<UserProfile>);
}
