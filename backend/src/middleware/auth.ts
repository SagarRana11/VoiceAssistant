import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

interface JWTPayload {
  id: string;
  iat: number;
  exp: number;
}

export async function protect(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    res.status(401).json({ message: 'Access denied. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JWTPayload;

    const user = await User.findById(decoded.id).select('name email');
    if (!user) {
      res.status(401).json({ message: 'User not found.' });
      return;
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
    };

    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
}
