import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { SalaryService } from './salary.service';

@Controller('salary')
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  @Get('config')
  async getConfig(@Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.salaryService.getSalaryConfig(userId);
  }

  @Post('config')
  async updateConfig(
    @Body() body: { userId: string; baseSalary?: number; workingDays?: number; otRatePerHour?: number }
  ) {
    if (!body.userId) {
      throw new BadRequestException('userId is required');
    }
    return this.salaryService.updateSalaryConfig(body.userId, body);
  }

  @Get('summary')
  async getSummary(
    @Query('userId') userId: string,
    @Query('month') month?: string,
    @Query('year') year?: string
  ) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const targetMonth = month ? parseInt(month, 10) : undefined;
    const targetYear = year ? parseInt(year, 10) : undefined;
    
    return this.salaryService.getMonthlySummary(userId, targetMonth, targetYear);
  }
}
