import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { BudgetsService } from './budgets.service';

@Controller('finance/budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  async getBudgets(@Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.budgetsService.getBudgets(userId);
  }

  @Post()
  async updateBudget(
    @Body() body: { userId: string; category: string; limit: number }
  ) {
    if (!body.userId || !body.category || body.limit === undefined) {
      throw new BadRequestException('userId, category, and limit are required');
    }
    return this.budgetsService.updateBudget(body.userId, body.category, body.limit);
  }
}
