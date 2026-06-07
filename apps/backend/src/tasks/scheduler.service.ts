import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly telegramService: TelegramService) {}

  // Scheduled Morning Briefing (Runs daily at 8:30 AM)
  @Cron('0 30 8 * * *')
  async handleMorningBriefing() {
    this.logger.log('Triggered: Scheduled Morning Briefing Cron...');
    const userId = 'mock-user-uuid-1234-5678'; // Target mock user
    try {
      await this.telegramService.dispatchMorningBriefing(userId);
    } catch (err) {
      this.logger.error('Failed to run morning cron briefing', err);
    }
  }

  // Scheduled Evening Briefing (Runs daily at 7:30 PM)
  @Cron('0 30 19 * * *')
  async handleEveningSummary() {
    this.logger.log('Triggered: Scheduled Evening Summary Cron...');
    const userId = 'mock-user-uuid-1234-5678';
    try {
      await this.telegramService.dispatchEveningSummary(userId);
    } catch (err) {
      this.logger.error('Failed to run evening cron summary', err);
    }
  }
}
