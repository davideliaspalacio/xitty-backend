import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Verificar si hay un header de autorización
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization token required');
    }

    // Verificar que sea un Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid token format. Use: Bearer <token>');
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
      const decoded = jwt.verify(token, jwtSecret) as any;

      // Verificar que sea un access token
      if (decoded.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Agregar información del usuario al request
      (request as any).user = {
        id: decoded.sub,
        role: decoded.role,
        email: decoded.email,
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
