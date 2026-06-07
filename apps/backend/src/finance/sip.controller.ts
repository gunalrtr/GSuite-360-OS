import { Controller, Get, Post, Delete, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { SipService } from './sip.service';

@Controller('finance/sip')
export class SipController {
  constructor(private readonly sipService: SipService) {}

  @Get()
  async getSips(@Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.sipService.getSips(userId);
  }

  @Post()
  async createSip(
    @Body() body: { userId: string; fundName: string; amount: number; investmentDate: number }
  ) {
    if (!body.userId || !body.fundName || !body.amount || body.investmentDate === undefined) {
      throw new BadRequestException('userId, fundName, amount, and investmentDate are required');
    }
    return this.sipService.createSip(body.userId, body);
  }

  @Delete(':id')
  async deleteSip(@Param('id') id: string, @Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const success = await this.sipService.deleteSip(userId, id);
    return { success };
  }
}
