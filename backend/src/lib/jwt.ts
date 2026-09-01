import jwt, { type SignOptions } from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

export interface TokenPayload extends JwtPayload {
  id: number;
  email: string;
  name: string;
  role: string;
}

export function signToken(payload: { id: number; email: string; name: string; role: string }): string {
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN as SignOptions["expiresIn"] };
  return jwt.sign(payload, JWT_SECRET, options);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}