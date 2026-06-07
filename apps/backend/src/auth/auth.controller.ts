import { Controller, Post, Get, Body, Req, Headers, BadRequestException } from '@nestjs/common';
import { AuthService, UserSession } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() body: { email: string; name: string; avatarUrl?: string }
  ): Promise<UserSession> {
    if (!body.email) {
      throw new BadRequestException('Email is required');
    }
    return this.authService.validateUser(body.email, body.name || 'User', body.avatarUrl);
  }

  @Get('profile')
  async getProfile(@Headers('Authorization') authHeader?: string): Promise<UserSession> {
    // If authHeader is passed, extract ID (for development simplicity, treat the header value as userId)
    let userId = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      userId = authHeader.substring(7);
    }
    
    if (!userId) {
      return this.authService.getMockUser();
    }
    
    return this.authService.getUserProfile(userId);
  }

  @Get('mock')
  getMock(): UserSession {
    return this.authService.getMockUser();
  }
}
