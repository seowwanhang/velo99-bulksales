import crypto from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

const COOKIE_NAME = 'velo99_session';

function getSecret(): string {
  return process.env.AUTH_SECRET || 'velo99-dev-fallback-secret-change-me-in-prod';
}

function signPayload(payloadB64: string): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest('base64url');
}

export function createSessionToken(userId: string): string {
  const payload = JSON.stringify({
    uid: userId,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  });
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const sig = signPayload(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token: string): { uid: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expected = signPayload(payloadB64);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!parsed.uid || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    return { uid: parsed.uid };
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string) {
  const token = createSessionToken(userId);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export interface SessionUser {
  id: string;
  email: string;
  phone: string;
  name: string;
  companyName: string;
  role: string;
  tier: string;
  creditLimit: number;
  creditUsed: number;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const verified = verifySessionToken(token);
  if (!verified) return null;
  const user = await prisma.user.findUnique({
    where: { id: verified.uid },
    select: {
      id: true,
      email: true,
      phone: true,
      name: true,
      companyName: true,
      role: true,
      tier: true,
      creditLimit: true,
      creditUsed: true,
      active: true,
    },
  });
  if (!user || !user.active) return null;
  return user;
}

export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}
