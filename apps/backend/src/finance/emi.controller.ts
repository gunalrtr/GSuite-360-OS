import { Controller, Get, Post, Delete, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { EmiService } from './emi.service';

@Controller('finance/emi')
export class EmiController {
  constructor(private readonly emiService: EmiService) {}

  @Get()
  async getEmis(@Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.emiService.getEmis(userId);
  }

  @Post()
  async createEmi(
    @Body() body: { userId: string; loanName: string; amount: number; dueDate: string; remainingMonths: number; totalMonths: number }
  ) {
    if (!body.userId || !body.loanName || !body.amount || !body.dueDate) {
      throw new BadRequestException('userId, loanName, amount, and dueDate are required');
    }
    return this.emiService.createEmi(body.userId, body);
  }

  @Delete(':id')
  async deleteEmi(@Param('id') id: string, @Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const success = await this.emiService.deleteEmi(userId, id);
    return { success };
  }
}
