import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import * as jwt from 'jsonwebtoken';

interface AuthenticatedUser {
  id: string;
  role: string;
  email?: string;
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const isJwtPayloadRecord = (
  payload: string | jwt.JwtPayload,
): payload is jwt.JwtPayload & Record<string, unknown> =>
  typeof payload === 'object' && payload !== null;

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Verificar si hay un header de autorización
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization token required');
    }

    // Verificar que sea un Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Invalid token format. Use: Bearer <token>',
      );
    }

    const token = authHeader.substring(7); // Remover "Bearer "

    if (!token) {
      throw new UnauthorizedException('Token not provided');
    }

    try {
      // Verificar que JWT_SECRET esté configurado
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new UnauthorizedException('JWT secret not configured');
      }

      // Verificar el JWT token
      const decoded = jwt.verify(token, jwtSecret);

      // Verificar que sea un access token
      if (!isJwtPayloadRecord(decoded) || decoded.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Agregar información del usuario al request
      if (typeof decoded.sub !== 'string') {
        throw new UnauthorizedException('Invalid token payload');
      }

      request.user = {
        id: decoded.sub,
        role: typeof decoded.role === 'string' ? decoded.role : 'user',
        email: typeof decoded.email === 'string' ? decoded.email : undefined,
      };

      return true;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token expired');
      }
      throw new UnauthorizedException('Token verification failed');
    }
  }
}
