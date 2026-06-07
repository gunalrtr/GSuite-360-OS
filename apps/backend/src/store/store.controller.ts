import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { StoreService } from './store.service';

@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get('logs')
  async getStoreLogs(@Query('userId') userId: string) {
    const activeUserId = userId || 'mock-user-uuid';
    const logs = await this.storeService.getStoreLogs(activeUserId);
    return { success: true, logs };
  }

  @Post('logs')
  async createStoreLog(
    @Body('userId') userId: string,
    @Body('grnCount') grnCount: number,
    @Body('poCount') poCount: number,
    @Body('vehicleEntries') vehicleEntries: number,
    @Body('materialReceipts') materialReceipts: number,
    @Body('stockVerifications') stockVerifications: number,
    @Body('notes') notes: string,
  ) {
    const activeUserId = userId || 'mock-user-uuid';
    const log = await this.storeService.createStoreLog(activeUserId, {
      grnCount,
      poCount,
      vehicleEntries,
      materialReceipts,
      stockVerifications,
      notes,
    });
    return { success: true, log };
  }

  @Get('kpis')
  async getStoreKPIs(@Query('userId') userId: string) {
    const activeUserId = userId || 'mock-user-uuid';
    const kpis = await this.storeService.getKPIs(activeUserId);
    return { success: true, kpis };
  }
}
