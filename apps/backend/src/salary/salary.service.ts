import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';

export interface SalaryConfig {
  userId: string;
  baseSalary: number;
  workingDays: number;
  dailySalary: number;
  hourlyRate: number;
  otRatePerHour: number;
  currency: string;
}

export interface MonthlySalarySummary {
  expectedSalary: number;
  earnedTillDate: number;
  otEarnings: number;
  leaveDeductions: number;
  netEarned: number;
  projectedSalary: number;
}

@Injectable()
export class SalaryService {
  private readonly logger = new Logger(SalaryService.name);

  // In-memory fallback config
  private inMemoryConfig: SalaryConfig = {
    userId: 'mock-user-uuid-1234-5678',
    baseSalary: 16640.0,   // 640/day × 26 days
    workingDays: 26,
    dailySalary: 640.0,
    hourlyRate: 80.0,      // 640 / 8h
    otRatePerHour: 100.0,  // OT rate (1.25× base hourly)
    currency: 'INR',
  };

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AttendanceService))
    private readonly attendanceService: AttendanceService
  ) {}

  async getSalaryConfig(userId: string): Promise<SalaryConfig> {
    try {
      const config = await this.prisma.salaryConfig.findUnique({
        where: { userId },
      });

      if (!config) {
        // Return default seeded db config
        const newConfig = await this.prisma.salaryConfig.create({
          data: {
            userId,
            baseSalary: 16640.0,
            workingDays: 26,
            dailySalary: 640.0,
            hourlyRate: 80.0,
            otRatePerHour: 100.00,
          },
        });
        return newConfig;
      }

      return config;
    } catch (error) {
      this.logger.warn(`getSalaryConfig: Database offline, using memory config. Error: ${error instanceof Error ? error.message : String(error)}`);
      return this.inMemoryConfig;
    }
  }

  async updateSalaryConfig(userId: string, data: Partial<SalaryConfig>): Promise<SalaryConfig> {
    const base = data.baseSalary ?? 16640.0;  // 640/day × 26 days
    const days = data.workingDays ?? 26;
    const otRate = data.otRatePerHour ?? 100.0;

    const dailySalary = parseFloat((base / days).toFixed(2));
    const hourlyRate = parseFloat((dailySalary / 8.0).toFixed(2));

    try {
      const config = await this.prisma.salaryConfig.upsert({
        where: { userId },
        update: {
          baseSalary: base,
          workingDays: days,
          dailySalary,
          hourlyRate,
          otRatePerHour: otRate,
        },
        create: {
          userId,
          baseSalary: base,
          workingDays: days,
          dailySalary,
          hourlyRate,
          otRatePerHour: otRate,
        },
      });
      return config;
    } catch (error) {
      this.logger.warn(`updateSalaryConfig: Database offline, updating memory config. Error: ${error instanceof Error ? error.message : String(error)}`);
      
      this.inMemoryConfig.baseSalary = base;
      this.inMemoryConfig.workingDays = days;
      this.inMemoryConfig.dailySalary = dailySalary;
      this.inMemoryConfig.hourlyRate = hourlyRate;
      this.inMemoryConfig.otRatePerHour = otRate;
      
      return this.inMemoryConfig;
    }
  }

  async getMonthlySummary(userId: string, month?: number, year?: number): Promise<MonthlySalarySummary> {
    const today = new Date();
    let targetMonth = month;
    let targetYear = year;
    
    if (targetMonth === undefined) {
      targetMonth = today.getMonth() + 1;
      targetYear = today.getFullYear();
      // If we are at or past the 26th, we are in the next month's attendance cycle
      if (today.getDate() >= 26) {
        targetMonth += 1;
        if (targetMonth === 13) {
          targetMonth = 1;
          targetYear += 1;
        }
      }
    }
    if (targetYear === undefined) {
      targetYear = today.getFullYear();
    }

    let startMonth = targetMonth - 1;
    let startYear = targetYear;
    if (startMonth === 0) {
      startMonth = 12;
      startYear--;
    }
    const startDate = new Date(startYear, startMonth - 1, 26, 0, 0, 0, 0);
    const endDate = new Date(targetYear, targetMonth - 1, 25, 23, 59, 59, 999);

    const config = await this.getSalaryConfig(userId);
    const dailyRate = config.dailySalary;
    const otRate = config.otRatePerHour;

    // Get attendance records for user
    const history = await this.attendanceService.getHistory(userId, 100);
    
    // Filter records for the target month & year based on custom attendance boundaries
    const monthlyRecords = history.filter(record => {
      const recDate = new Date(record.date);
      return recDate >= startDate && recDate <= endDate;
    });

    let earnedBase = 0.0;
    let otEarnings = 0.0;
    let leaveDeductions = 0.0;
    let presentDays = 0;
    let halfDays = 0;
    let leaveDays = 0;

    monthlyRecords.forEach(record => {
      if (record.status === 'PRESENT') {
        earnedBase += dailyRate * (record.salaryImpact || 1.0); // Respect shift salary impact
        presentDays++;

        if (record.otHours > 0) {
          otEarnings += record.otHours * otRate;
        }
      } else if (record.status === 'HALF_DAY') {
        earnedBase += 0.5 * dailyRate;
        leaveDeductions += 0.5 * dailyRate;
        halfDays++;

        if (record.otHours > 0) {
          otEarnings += record.otHours * otRate;
        }
      } else if (record.status === 'LEAVE') {
        leaveDeductions += dailyRate;
        leaveDays++;
      }
    });

    // Calculate standard remaining working days in month
    // Total standard working days in month is config.workingDays
    const loggedWorkDays = presentDays + halfDays + leaveDays;
    const remainingDays = Math.max(0, config.workingDays - loggedWorkDays);
    
    const earnedTillDate = earnedBase;
    const netEarned = parseFloat((earnedTillDate + otEarnings).toFixed(2));
    
    // Project final salary at month end (assuming standard work for remaining days)
    const projectedSalary = parseFloat((netEarned + (remainingDays * dailyRate)).toFixed(2));

    return {
      expectedSalary: config.baseSalary,
      earnedTillDate: parseFloat(earnedTillDate.toFixed(2)),
      otEarnings: parseFloat(otEarnings.toFixed(2)),
      leaveDeductions: parseFloat(leaveDeductions.toFixed(2)),
      netEarned,
      projectedSalary,
    };
  }
}
