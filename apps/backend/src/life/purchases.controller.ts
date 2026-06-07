import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { PurchasesService } from './purchases.service';

@Controller('life/purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  async getPurchases(@Query('userId') userId: string) {
    const activeUserId = userId || 'mock-user-uuid';
    const purchases = await this.purchasesService.getPurchases(activeUserId);
    return { success: true, purchases };
  }

  @Post()
  async createPurchase(
    @Body('userId') userId: string,
    @Body('itemName') itemName: string,
    @Body('targetAmount') targetAmount: number,
    @Body('savedAmount') savedAmount: number,
    @Body('targetDate') targetDate: string,
  ) {
    const activeUserId = userId || 'mock-user-uuid';
    const purchase = await this.purchasesService.createPurchase(activeUserId, {
      itemName,
      targetAmount,
      savedAmount,
      targetDate: targetDate ? new Date(targetDate) : undefined,
    });
    return { success: true, purchase };
  }

  @Post(':id/savings')
  async addSavings(
    @Param('id') purchaseId: string,
    @Body('userId') userId: string,
    @Body('amount') amount: number,
  ) {
    const activeUserId = userId || 'mock-user-uuid';
    const purchase = await this.purchasesService.addSavings(activeUserId, purchaseId, amount);
    return { success: true, purchase };
  }
}
