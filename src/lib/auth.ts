import "server-only";

import {
  timingSafeEqual,
  pbkdf2Sync,
  randomBytes,
  createHmac,
  randomUUID,
} from "crypto";
import { cookies } from "next/headers";
import {
  type AuthDatabase,
  type Session,
  type User,
  readDatabase,
  writeDatabase,
} from "./database";

export type AuthenticatedUser = Pick<User, "id" | "username" | "name" | "role">;

export const SESSION_COOKIE_NAME = "whatsapp_sender_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const HASH_ITERATIONS = 210_000;
const HASH_KEY_LENGTH = 64;
const HASH_DIGEST = "sha512";

function getInitialAdminPassword() {
  if (process.env.ADMIN_INITIAL_PASSWORD) {
    return process.env.ADMIN_INITIAL_PASSWORD;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_INITIAL_PASSWORD must be set before creating admin.");
  }

  return "admin123";
}

function getSessionSecret() {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production.");
  }

  return "local-development-session-secret";
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(
    password,
    salt,
    HASH_ITERATIONS,
    HASH_KEY_LENGTH,
    HASH_DIGEST
  ).toString("hex");

  return `pbkdf2_${HASH_DIGEST}$${HASH_ITERATIONS}$${salt}$${hash}`;
}

function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, iterations, salt, storedHash] = passwordHash.split("$");

  if (algorithm !== `pbkdf2_${HASH_DIGEST}` || !iterations || !salt || !storedHash) {
    return false;
  }

  const storedHashBuffer = Buffer.from(storedHash, "hex");
  const calculatedHash = pbkdf2Sync(
    password,
    salt,
    Number(iterations),
    storedHashBuffer.length,
    HASH_DIGEST
  );

  return (
    calculatedHash.length === storedHashBuffer.length &&
    timingSafeEqual(calculatedHash, storedHashBuffer)
  );
}

function publicUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  };
}

function signSessionId(sessionId: string) {
  return createHmac("sha256", getSessionSecret()).update(sessionId).digest("hex");
}

function createSessionToken(sessionId: string) {
  return `${sessionId}.${signSessionId(sessionId)}`;
}

function verifySessionToken(token?: string) {
  if (!token) return null;

  const [sessionId, signature] = token.split(".");

  if (!sessionId || !signature) return null;

  const expectedSignature = signSessionId(sessionId);
  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  return sessionId;
}

async function ensureAdminUser(database: AuthDatabase) {
  const existingAdmin = database.users.find((user) => user.username === "admin");

  if (existingAdmin) {
    return existingAdmin;
  }

  const now = new Date().toISOString();
  const admin: User = {
    id: randomBytes(16).toString("hex"),
    username: "admin",
    name: "admin",
    role: "admin",
    passwordHash: hashPassword(getInitialAdminPassword()),
    createdAt: now,
  };

  database.users.push(admin);
  await writeDatabase(database);

  return admin;
}

export async function authenticateUser(username: string, password: string) {
  const database = await readDatabase();
  await ensureAdminUser(database);

  const user = database.users.find(
    (candidate) => candidate.username.toLowerCase() === username.toLowerCase()
  );

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return publicUser(user);
}

export async function createUserWithPassword(input: {
  name: string;
  username: string;
  password: string;
  role?: "admin";
}) {
  const database = await readDatabase();
  const username = input.username.trim();
  const name = input.name.trim();

  const existingUser = database.users.find(
    (candidate) => candidate.username.toLowerCase() === username.toLowerCase()
  );

  if (existingUser) {
    return {
      ok: false as const,
      message: "Ja existe um usuario com esse login.",
    };
  }

  const now = new Date().toISOString();
  const user: User = {
    id: randomUUID(),
    username,
    name,
    role: input.role ?? "admin",
    passwordHash: hashPassword(input.password),
    createdAt: now,
  };

  database.users.push(user);
  await writeDatabase(database);

  return {
    ok: true as const,
    message: "Usuario criado com sucesso.",
    user: publicUser(user),
  };
}

export async function createSession(userId: string) {
  const database = await readDatabase();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
  const session: Session = {
    id: randomUUID(),
    userId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  database.sessions = database.sessions.filter(
    (candidate) => new Date(candidate.expiresAt).getTime() > now.getTime()
  );
  database.sessions.push(session);
  await writeDatabase(database);

  return {
    token: createSessionToken(session.id),
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function deleteSession(token?: string) {
  const sessionId = verifySessionToken(token);

  if (!sessionId) return;

  const database = await readDatabase();
  database.sessions = database.sessions.filter((session) => session.id !== sessionId);
  await writeDatabase(database);
}

export async function getCurrentUser() {
  const authContext = await getCurrentAuthContext();

  return authContext?.user ?? null;
}

export async function getCurrentAuthContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const sessionId = verifySessionToken(token);

  if (!sessionId) return null;

  const database = await readDatabase();
  const now = Date.now();
  const session = database.sessions.find((candidate) => candidate.id === sessionId);

  if (!session || new Date(session.expiresAt).getTime() <= now) {
    await deleteSession(token);
    return null;
  }

  const user = database.users.find((candidate) => candidate.id === session.userId);

  if (!user) return null;

  return {
    user: publicUser(user),
    session: {
      id: session.id,
    },
  };
}

export function getSessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
