import { Controller, Get, Query } from '@nestjs/common';
import { HolidaysService } from './holidays.service';

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get()
  getHolidays() {
    return this.holidaysService.getHolidays();
  }

  @Get('upcoming')
  getUpcoming() {
    return this.holidaysService.getUpcomingHoliday();
  }

  @Get('check')
  checkHoliday(@Query('date') dateStr?: string) {
    const date = dateStr ? new Date(dateStr) : new Date();
    const holiday = this.holidaysService.isHoliday(date);
    return {
      isHoliday: !!holiday,
      holiday,
    };
  }
}
