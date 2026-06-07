import { Controller, Get, Post, Delete, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { ExpensesService } from './expenses.service';

@Controller('finance/expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  async getExpenses(@Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.expensesService.getExpenses(userId);
  }

  @Post()
  async createExpense(
    @Body() body: { userId: string; amount: number; description: string; category: string; date?: string }
  ) {
    if (!body.userId || !body.amount || !body.description || !body.category) {
      throw new BadRequestException('userId, amount, description, and category are required');
    }
    return this.expensesService.createExpense(body.userId, body);
  }

  @Delete(':id')
  async deleteExpense(@Param('id') id: string, @Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const success = await this.expensesService.deleteExpense(userId, id);
    return { success };
  }
}
