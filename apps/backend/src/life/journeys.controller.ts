import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { JourneysService } from './journeys.service';

@Controller('life/journeys')
export class JourneysController {
  constructor(private readonly journeysService: JourneysService) {}

  @Get()
  async getJourneys(@Query('userId') userId: string) {
    const activeUserId = userId || 'mock-user-uuid';
    const journeys = await this.journeysService.getJourneys(activeUserId);
    return { success: true, journeys };
  }

  @Post()
  async createJourney(
    @Body('userId') userId: string,
    @Body('destination') destination: string,
    @Body('budget') budget: number,
    @Body('startDate') startDate: string,
    @Body('endDate') endDate: string,
    @Body('checklist') checklist: string,
  ) {
    const activeUserId = userId || 'mock-user-uuid';
    const journey = await this.journeysService.createJourney(activeUserId, {
      destination,
      budget,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      checklist,
    });
    return { success: true, journey };
  }

  @Patch(':id/checklist')
  async updateChecklist(
    @Param('id') journeyId: string,
    @Body('userId') userId: string,
    @Body('checklist') checklistJson: string,
  ) {
    const activeUserId = userId || 'mock-user-uuid';
    const journey = await this.journeysService.updateChecklist(activeUserId, journeyId, checklistJson);
    return { success: true, journey };
  }
}
