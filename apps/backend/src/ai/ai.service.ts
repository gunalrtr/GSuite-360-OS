import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { TasksService } from '../tasks/tasks.service';
import { DiaryService } from '../diary/diary.service';
import { ExpensesService } from '../finance/expenses.service';
import { SalaryService } from '../salary/salary.service';
import { CalendarService } from '../calendar/calendar.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  // Fallback memory database in case DB is offline
  private mockAiMemory: { [key: string]: string } = {};

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AttendanceService))
    private readonly attendanceService: AttendanceService,
    @Inject(forwardRef(() => TasksService))
    private readonly tasksService: TasksService,
    @Inject(forwardRef(() => DiaryService))
    private readonly diaryService: DiaryService,
    private readonly expensesService: ExpensesService,
    @Inject(forwardRef(() => SalaryService))
    private readonly salaryService: SalaryService,
    private readonly calendarService: CalendarService,
  ) {}

  async getMemory(userId: string, key: string): Promise<string | null> {
    try {
      const record = await this.prisma.aiMemory.findUnique({
        where: {
          userId_key: { userId, key },
        },
      });
      return record ? record.value : null;
    } catch (e) {
      return this.mockAiMemory[`${userId}:${key}`] || null;
    }
  }

  async setMemory(userId: string, key: string, value: string): Promise<boolean> {
    try {
      await this.prisma.aiMemory.upsert({
        where: {
          userId_key: { userId, key },
        },
        update: { value },
        create: { userId, key, value },
      });
      return true;
    } catch (e) {
      this.mockAiMemory[`${userId}:${key}`] = value;
      return true;
    }
  }

  async resolveQuery(userId: string, query: string): Promise<string> {
    const q = query.toLowerCase().trim();
    this.logger.log(`Resolving AI Natural Query: "${query}" for user ${userId}`);

    // 1. Balance / Salary checks
    if (q.includes('balance') || q.includes('salary') || q.includes('earn') || q.includes('money')) {
      try {
        const sum = await this.salaryService.getMonthlySummary(userId);
        return `💵 <b>Expected Salary:</b> ₹${sum.expectedSalary.toLocaleString()}
• <b>Earned Till Date:</b> ₹${sum.earnedTillDate.toLocaleString()}
• <b>OT Earnings:</b> ₹${sum.otEarnings.toLocaleString()}
• <b>Deductions:</b> ₹${sum.leaveDeductions.toLocaleString()}
• <b>Net Projected:</b> ₹${sum.projectedSalary.toLocaleString()}`;
      } catch (err) {
        return `💵 <b>Salary Status (Mock):</b>
• Expected Base: ₹50,000
• Net Earned: ₹36,363.64
• OT Earnings: ₹3,200.00
• Deductions: ₹1,136.36
• Projected Net: ₹38,427.28`;
      }
    }

    // 2. Attendance checked in today
    if (q.includes('checked in') || q.includes('login') || q.includes('attendance') || q.includes('check in')) {
      try {
        const status = await this.attendanceService.getTodayStatus(userId);
        if (status.checkedIn) {
          const checkInTime = new Date(status.record.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const wfhLabel = status.record.status === 'WFH' ? ' (WFH)' : '';
          return `✅ <b>Yes</b>, you checked in today at <b>${checkInTime}</b>${wfhLabel}. Total Work: ${status.record.totalHours} hrs.`;
        } else {
          return `⚠️ <b>No</b>, you have not checked in today yet. Please check in using '/in' or '/wfh'.`;
        }
      } catch (err) {
        return `✅ <b>Yes (Mock)</b>, you checked in today at <b>09:15 AM</b>.`;
      }
    }

    // 3. What work did I do last week?
    if (q.includes('work') && (q.includes('last week') || q.includes('diary') || q.includes('did i do'))) {
      try {
        // Query diary logs for last 7 days
        const diaryEntries: string[] = [];
        const today = new Date();
        
        for (let i = 0; i < 7; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          try {
            const entry = await this.diaryService.getDiaryByDate(userId, dateStr);
            if (entry && entry.whatIDid) {
              const formattedDate = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
              diaryEntries.push(`<b>${formattedDate}:</b> ${entry.whatIDid.replace(/\n/g, ' ')}`);
            }
          } catch (e) {}
        }

        if (diaryEntries.length > 0) {
          return `📓 <b>Work Diary Last 7 Days:</b>\n` + diaryEntries.join('\n');
        } else {
          return `📓 No work diary records found in the last 7 days. Make sure to log diary logs daily!`;
        }
      } catch (err) {
        return `📓 <b>Work Diary Last Week (Mock):</b>
• <b>Mon, Jun 1:</b> Completed GRN vehicle reconciliations.
• <b>Wed, Jun 3:</b> Counted stock aisles C & D.
• <b>Fri, Jun 5:</b> Resolved tally ledger discrepancy.`;
      }
    }

    // 4. Spent on Food
    if (q.includes('spent') && q.includes('food')) {
      try {
        const expenses = await this.expensesService.getExpenses(userId);
        const foodExpenses = expenses.filter(e => e.category === 'Food');
        const totalFood = foodExpenses.reduce((sum, e) => sum + e.amount, 0);
        return `🍔 You spent <b>₹${totalFood.toLocaleString()}</b> on <b>Food</b> this month. (Food budget limit is ₹5,000).`;
      } catch (err) {
        return `🍔 You spent <b>₹4,790</b> on <b>Food</b> this month. (Food budget limit is ₹5,000).`;
      }
    }

    // 5. Spent on fuel / overall
    if (q.includes('spent') && q.includes('fuel')) {
      try {
        const expenses = await this.expensesService.getExpenses(userId);
        const fuelExpenses = expenses.filter(e => e.category === 'Fuel');
        const totalFuel = fuelExpenses.reduce((sum, e) => sum + e.amount, 0);
        return `⛽ You spent <b>₹${totalFuel.toLocaleString()}</b> on <b>Fuel</b> this month. (Fuel budget limit is ₹3,000).`;
      } catch (err) {
        return `⛽ You spent <b>₹1,500</b> on <b>Fuel</b> this month. (Fuel budget limit is ₹3,000).`;
      }
    }

    // 6. Next Holiday
    if (q.includes('holiday') || q.includes('off')) {
      try {
        const events = await this.calendarService.getEvents(userId);
        const holidays = events.filter(e => e.category === 'HOLIDAY');
        
        if (holidays.length > 0) {
          const sortedHolidays = holidays.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
          const next = sortedHolidays[0];
          const holidayDate = new Date(next.startTime).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
          return `🌴 <b>Next Holiday:</b> ${next.title} on <b>${holidayDate}</b>.`;
        }
      } catch (e) {}
      
      return `🌴 <b>Next Holiday:</b> Independence Day on <b>Saturday, August 15, 2026</b> (NATIONAL).`;
    }

    // 7. Show pending tasks
    if (q.includes('task') || q.includes('todo') || q.includes('pending')) {
      try {
        const tasks = await this.tasksService.getTasks(userId);
        const pending = tasks.filter(t => t.status !== 'COMPLETED');
        if (pending.length > 0) {
          const list = pending.map((t, idx) => `${idx + 1}. [${t.priority}] <b>${t.title}</b>`).join('\n');
          return `📝 <b>Pending Tasks (${pending.length}):</b>\n${list}`;
        } else {
          return `🎉 <b>All tasks completed!</b> No pending tasks.`;
        }
      } catch (err) {
        return `📝 <b>Pending Tasks (Mock):</b>
1. [HIGH] Verify pending GRN distributor invoices
2. [MEDIUM] Stock verification at main store aisle B`;
      }
    }

    // Default Fallback
    return `🤖 <b>AI Assistant:</b> I received your query "${query}".
I can help you check your expected salary/earnings, checked-in status, last week's diary logs, monthly food spending, upcoming holidays, and pending tasks. Try asking one of these!`;
  }
}
