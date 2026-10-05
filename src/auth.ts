import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 16) throw new Error('JWT_SECRET must be set (16+ characters)');

export const sign = (id: number) => jwt.sign({ sub: id }, SECRET, { expiresIn: '12h' });

export const requireAuth: RequestHandler = (req, res, next) => {
  try {
    jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
