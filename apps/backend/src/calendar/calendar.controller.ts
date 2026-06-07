import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { CalendarService } from './calendar.service';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  async getEvents(@Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.calendarService.getEvents(userId);
  }

  @Post()
  async createEvent(
    @Body() body: { userId: string; title: string; description?: string; startTime: string; endTime: string; category: string; location?: string }
  ) {
    if (!body.userId || !body.title || !body.startTime || !body.endTime) {
      throw new BadRequestException('userId, title, startTime, and endTime are required');
    }
    return this.calendarService.createEvent(body.userId, {
      ...body,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      category: body.category as any,
    });
  }
}
