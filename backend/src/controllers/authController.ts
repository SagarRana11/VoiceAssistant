import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function signToken(userId: string): string {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  });
}

function formatUser(user: IUser) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    initials: user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2),
  };
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ message: 'Name, email, and password are required.' });
    return;
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    res.status(409).json({ message: 'An account with this email already exists.' });
    return;
  }

  const user = await User.create({ name: name.trim(), email, password });
  const token = signToken(user._id.toString());

  res.status(201).json({
    success: true,
    token,
    user: formatUser(user),
  });
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required.' });
    return;
  }

  // Explicitly select password since it's excluded by default
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+password'
  );

  if (!user || !(await user.comparePassword(password))) {
    res.status(401).json({ message: 'Invalid email or password.' });
    return;
  }

  const token = signToken(user._id.toString());

  res.status(200).json({
    success: true,
    token,
    user: formatUser(user),
  });
}

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
export async function getMe(req: Request, res: Response): Promise<void> {
  // req.user is populated by the protect middleware
  const user = (req as Request & { user: { id: string } }).user;
  const found = await User.findById(user.id);

  if (!found) {
    res.status(404).json({ message: 'User not found.' });
    return;
  }

  res.status(200).json({
    success: true,
    user: formatUser(found),
  });
}
