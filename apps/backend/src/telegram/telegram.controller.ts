import { Controller, Post, Get, Body, Query, BadRequestException } from '@nestjs/common';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('command')
  async handleIncomingMessage(
    @Body() body: { userId: string; message: string }
  ) {
    if (!body.userId || !body.message) {
      throw new BadRequestException('userId and message are required');
    }
    return this.telegramService.handleCommand(body.userId, body.message);
  }

  @Post('briefing/morning')
  async triggerMorningBriefing(@Body() body: { userId: string }) {
    if (!body.userId) {
      throw new BadRequestException('userId is required');
    }
    const success = await this.telegramService.dispatchMorningBriefing(body.userId);
    return { success, message: 'Morning briefing dispatched.' };
  }

  @Post('briefing/evening')
  async triggerEveningSummary(@Body() body: { userId: string }) {
    if (!body.userId) {
      throw new BadRequestException('userId is required');
    }
    const success = await this.telegramService.dispatchEveningSummary(body.userId);
    return { success, message: 'Evening summary dispatched.' };
  }

  @Get('briefing/morning')
  async previewMorningBriefing(@Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const text = await this.telegramService.getMorningBriefing(userId);
    return { text };
  }

  @Get('briefing/evening')
  async previewEveningSummary(@Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const text = await this.telegramService.getEveningSummary(userId);
    return { text };
  }
}
