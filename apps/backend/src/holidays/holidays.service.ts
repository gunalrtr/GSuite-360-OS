import { Injectable } from '@nestjs/common';

export interface Holiday {
  name: string;
  date: string; // YYYY-MM-DD
  type: 'NATIONAL' | 'STATE';
}

@Injectable()
export class HolidaysService {
  // Configured list of national & Tamil Nadu state holidays for 2026
  private holidays: Holiday[] = [
    { name: 'Pongal', date: '2026-01-14', type: 'STATE' },
    { name: 'Republic Day', date: '2026-01-26', type: 'NATIONAL' },
    { name: 'Tamil New Year', date: '2026-04-14', type: 'STATE' },
    { name: 'Labour Day / May Day', date: '2026-05-01', type: 'NATIONAL' },
    { name: 'Independence Day', date: '2026-08-15', type: 'NATIONAL' },
    { name: 'Gandhi Jayanti', date: '2026-10-02', type: 'NATIONAL' },
    { name: 'Deepavali', date: '2026-11-08', type: 'STATE' }
  ];

  getHolidays(): Holiday[] {
    return this.holidays;
  }

  private getLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  isHoliday(date: Date): Holiday | null {
    const dateStr = this.getLocalDateString(date);
    return this.holidays.find(h => h.date === dateStr) || null;
  }

  getUpcomingHoliday(afterDate: Date = new Date()): Holiday | null {
    const sorted = [...this.holidays].sort((a, b) => a.date.localeCompare(b.date));
    const afterDateStr = this.getLocalDateString(afterDate);
    
    // Find first holiday after afterDateStr
    const next = sorted.find(h => h.date >= afterDateStr);
    return next || sorted[0] || null; // Wrap around to first holiday of next year
  }
}
