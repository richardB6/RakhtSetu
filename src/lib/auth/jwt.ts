import { SignJWT, jwtVerify, JWTPayload } from 'jose';

const JWT_ACCESS_SECRET = new TextEncoder().encode(
  process.env.JWT_ACCESS_SECRET || 'fallback-access-secret-min-32-chars-long!!'
);
const JWT_REFRESH_SECRET = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-min-32-chars-long!!'
);

export type UserRole = 'HOSPITAL' | 'BLOOD_BANK' | 'DONOR' | 'ADMIN';

export interface UserTokenPayload extends JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
}

export async function signAccessToken(
  payload: Omit<UserTokenPayload, keyof JWTPayload>
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_ACCESS_SECRET);
}

export async function signRefreshToken(payload: {
  userId: string;
}): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_REFRESH_SECRET);
}

export async function verifyAccessToken(
  token: string
): Promise<UserTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_ACCESS_SECRET);
    return payload as UserTokenPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_REFRESH_SECRET);
    return payload as { userId: string };
  } catch {
    return null;
  }
}
