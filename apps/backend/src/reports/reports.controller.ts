import { Controller, Get, Query, Header, Response } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  async getSummary(@Query('userId') userId: string) {
    const activeUserId = userId || 'mock-user-uuid';
    const summary = await this.reportsService.getReportsSummary(activeUserId);
    return { success: true, summary };
  }

  @Get('export')
  async exportReport(
    @Query('userId') userId: string,
    @Query('type') type: 'attendance' | 'salary' | 'expenses' | 'work',
    @Response() res: any,
  ) {
    const activeUserId = userId || 'mock-user-uuid';
    const reportType = type || 'expenses';
    const csvContent = await this.reportsService.getCSVReport(activeUserId, reportType);

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="gsuite360_report_${reportType}.csv"`,
    });

    return res.send(csvContent);
  }
}
