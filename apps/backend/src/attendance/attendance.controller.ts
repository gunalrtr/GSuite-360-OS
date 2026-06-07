import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { AttendanceService, ShiftType } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('today')
  async getToday(@Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.attendanceService.getTodayStatus(userId);
  }

  @Post('check-in')
  async checkIn(@Body() body: { userId: string; shift?: ShiftType }) {
    if (!body.userId) {
      throw new BadRequestException('userId is required');
    }
    const shift: ShiftType = body.shift || 'FULL_DAY';
    return this.attendanceService.checkIn(body.userId, shift);
  }

  @Post('break-in')
  async startBreak(@Body() body: { userId: string }) {
    if (!body.userId) {
      throw new BadRequestException('userId is required');
    }
    return this.attendanceService.startBreak(body.userId);
  }

  @Post('break-out')
  async endBreak(@Body() body: { userId: string }) {
    if (!body.userId) {
      throw new BadRequestException('userId is required');
    }
    return this.attendanceService.endBreak(body.userId);
  }

  @Post('check-out')
  async checkOut(@Body() body: { userId: string }) {
    if (!body.userId) {
      throw new BadRequestException('userId is required');
    }
    return this.attendanceService.checkOut(body.userId);
  }

  @Post('leave')
  async applyLeave(@Body() body: { userId: string; date: string; status: 'LEAVE' | 'HALF_DAY' }) {
    if (!body.userId || !body.date || !body.status) {
      throw new BadRequestException('userId, date, and status are required');
    }
    return this.attendanceService.applyLeave(body.userId, body.date, body.status);
  }

  @Get('history')
  async getHistory(
    @Query('userId') userId: string,
    @Query('limit') limit?: string
  ) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const limitVal = limit ? parseInt(limit, 10) : 30;
    return this.attendanceService.getHistory(userId, limitVal);
  }

  @Post('manual')
  async manualEntry(
    @Body() body: {
      userId: string;
      date: string;
      shift: ShiftType;
      checkedInAt?: string;
      checkedOutAt?: string;
      status: 'PRESENT' | 'HALF_DAY' | 'LEAVE';
    }
  ) {
    if (!body.userId || !body.date || !body.status) {
      throw new BadRequestException('userId, date, and status are required');
    }
    if (body.status !== 'LEAVE' && (!body.checkedInAt || !body.checkedOutAt)) {
      throw new BadRequestException('checkedInAt and checkedOutAt are required for PRESENT/HALF_DAY status');
    }
    return this.attendanceService.manualEntry(
      body.userId,
      body.date,
      body.shift || 'FULL_DAY',
      body.checkedInAt || body.date,
      body.checkedOutAt || body.date,
      body.status,
    );
  }
}
