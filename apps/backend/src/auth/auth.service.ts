import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class UserSession {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  
  // In-memory fallback if database is offline or not set up
  private inMemoryUser: UserSession = {
    id: 'mock-user-uuid-1234-5678',
    email: 'gunalrtr@gmail.com',
    name: 'Gunal',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
    role: 'STORE_EXECUTIVE',
  };

  constructor(private readonly prisma: PrismaService) {}

  async validateUser(email: string, name: string, avatarUrl?: string): Promise<UserSession> {
    try {
      let user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email,
            name,
            avatarUrl,
            role: 'STORE_EXECUTIVE',
          },
        });
        
        // Auto-create salary configuration for new user
        await this.prisma.salaryConfig.create({
          data: {
            userId: user.id,
            baseSalary: 50000.0,
            workingDays: 22,
            dailySalary: 2272.73,
            hourlyRate: 284.09,
            otRatePerHour: 400.00,
          },
        });
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name || 'Gunal',
        avatarUrl: user.avatarUrl || undefined,
        role: user.role,
      };
    } catch (error) {
      this.logger.warn(`validateUser: Database offline. Falling back to in-memory session. Error: ${error instanceof Error ? error.message : String(error)}`);
      // Update in-memory user with provided details
      this.inMemoryUser.email = email;
      this.inMemoryUser.name = name;
      if (avatarUrl) this.inMemoryUser.avatarUrl = avatarUrl;
      return this.inMemoryUser;
    }
  }

  async getUserProfile(userId: string): Promise<UserSession> {
    try {
      if (userId === this.inMemoryUser.id) {
        return this.inMemoryUser;
      }
      
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name || 'Gunal',
        avatarUrl: user.avatarUrl || undefined,
        role: user.role,
      };
    } catch (error) {
      this.logger.warn(`getUserProfile: Database lookup failed, returning in-memory user. Error: ${error instanceof Error ? error.message : String(error)}`);
      return this.inMemoryUser;
    }
  }

  getMockUser(): UserSession {
    return this.inMemoryUser;
  }
}
