import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { DiaryService } from './diary.service';

@Controller('diary')
export class DiaryController {
  constructor(private readonly diaryService: DiaryService) {}

  @Get()
  async getDiary(
    @Query('userId') userId: string,
    @Query('date') date: string
  ) {
    if (!userId || !date) {
      throw new BadRequestException('userId and date are required');
    }
    return this.diaryService.getDiaryByDate(userId, date);
  }

  @Post()
  async saveDiary(
    @Body() body: { userId: string; date: string; whatIDid: string; issuesFaced?: string; learnings?: string; notes?: string; tomorrowPlan?: string }
  ) {
    if (!body.userId || !body.date) {
      throw new BadRequestException('userId and date are required');
    }
    const { date, ...rest } = body;
    return this.diaryService.saveDiary(body.userId, date, rest);
  }

  @Get('recent')
  async getRecent(
    @Query('userId') userId: string,
    @Query('limit') limit?: string
  ) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const limitVal = limit ? parseInt(limit, 10) : 10;
    return this.diaryService.getRecentDiaries(userId, limitVal);
  }
}
