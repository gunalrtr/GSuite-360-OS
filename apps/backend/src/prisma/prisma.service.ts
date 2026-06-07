import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connected successfully');
    } catch (error) {
      this.logger.warn('Failed to connect to the database. Please check your DATABASE_URL in .env');
      this.logger.warn(error instanceof Error ? error.message : String(error));
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
