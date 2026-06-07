import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ParserService } from '../parser/parser.service';
import { AttendanceService } from '../attendance/attendance.service';
import { TasksService } from '../tasks/tasks.service';
import { DiaryService } from '../diary/diary.service';
import { CalendarService } from '../calendar/calendar.service';
import { ExpensesService } from '../finance/expenses.service';
import { EmiService } from '../finance/emi.service';
import { JourneysService } from '../life/journeys.service';
import { PurchasesService } from '../life/purchases.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly parserService: ParserService,
    @Inject(forwardRef(() => AttendanceService))
    private readonly attendanceService: AttendanceService,
    @Inject(forwardRef(() => TasksService))
    private readonly tasksService: TasksService,
    @Inject(forwardRef(() => DiaryService))
    private readonly diaryService: DiaryService,
    private readonly calendarService: CalendarService,
    private readonly expensesService: ExpensesService,
    private readonly emiService: EmiService,
    private readonly journeysService: JourneysService,
    private readonly purchasesService: PurchasesService,
    private readonly aiService: AiService
  ) {
    this.initializeBot();
  }

  private initializeBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || token === 'your-telegram-bot-token') {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not configured in .env. Operating in Mock mode.');
      return;
    }

    this.logger.log('Telegram Bot Service initialized successfully.');
    // In a production setup, we can run a polling loop or set up webhook.
    // For local testing, we provide REST endpoints to mock incoming telegram commands.
  }

  async sendTelegramMessage(text: string): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId || token === 'your-telegram-bot-token') {
      this.logger.log(`[Telegram Broadcast (Mock Mode)]:\n${text}`);
      return false;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML',
        }),
      });
      return response.ok;
    } catch (error) {
      this.logger.error('Failed to dispatch telegram message:', error);
      return false;
    }
  }

  // Processes commands sent to the bot (e.g. from `/in` or `/task Verify GRN`)
  async handleCommand(userId: string, messageText: string): Promise<any> {
    this.logger.log(`Processing Telegram Command for user ${userId}: "${messageText}"`);

    // Extract text commands (remove slash if present)
    const cleanCommand = messageText.startsWith('/') ? messageText.substring(1) : messageText;
    const parsed = this.parserService.parseText(cleanCommand);

    if (parsed.type === 'ATTENDANCE') {
      const { action, isWfh } = parsed.data;
      if (action === 'IN') {
        const result = await this.attendanceService.checkIn(userId, isWfh);
        const responseText = `✅ Checked IN successfully${isWfh ? ' (WFH)' : ''} at ${new Date(result.record.checkedInAt).toLocaleTimeString()}`;
        await this.sendTelegramMessage(responseText);
        return { success: true, message: responseText, data: result };
      } else if (action === 'OUT') {
        const result = await this.attendanceService.checkOut(userId);
        const responseText = `⛔ Checked OUT successfully at ${new Date(result.record.checkedOutAt).toLocaleTimeString()}.\nTotal Work Hours: ${result.record.totalHours} hrs (OT: ${result.record.otHours} hrs).`;
        await this.sendTelegramMessage(responseText);
        return { success: true, message: responseText, data: result };
      } else if (action === 'LEAVE') {
        const todayStr = new Date().toISOString().split('T')[0];
        const result = await this.attendanceService.applyLeave(userId, todayStr, 'LEAVE');
        const responseText = `🌴 Applied LEAVE for today. Salary deduction logged.`;
        await this.sendTelegramMessage(responseText);
        return { success: true, message: responseText, data: result };
      }
    }

    if (parsed.type === 'TASK') {
      const result = await this.tasksService.createTask(userId, parsed.data);
      const responseText = `📝 Created Task: "${result.title}" (Priority: ${result.priority})`;
      await this.sendTelegramMessage(responseText);
      return { success: true, message: responseText, data: result };
    }

    if (parsed.type === 'DIARY') {
      const todayStr = new Date().toISOString().split('T')[0];
      const diary = await this.diaryService.getDiaryByDate(userId, todayStr);
      const updatedWhatIDid = diary && diary.whatIDid ? `${diary.whatIDid}\n- ${parsed.data.whatIDid}` : `- ${parsed.data.whatIDid}`;
      
      const result = await this.diaryService.saveDiary(userId, todayStr, {
        whatIDid: updatedWhatIDid,
      });
      const responseText = `📓 Logged in Work Diary: "${parsed.data.whatIDid}"`;
      await this.sendTelegramMessage(responseText);
      return { success: true, message: responseText, data: result };
    }

    if (parsed.type === 'EXPENSE') {
      const result = await this.expensesService.createExpense(userId, {
        amount: parsed.data.amount,
        description: parsed.data.description,
        category: parsed.data.category,
      });
      let responseText = `💸 Recorded Expense: ₹${result.record.amount} for "${result.record.description}" (${result.record.category})`;
      if (result.budgetWarning) {
        responseText += `\n⚠️ <b>BUDGET ALERT</b>: ${result.budgetMessage}`;
      }
      await this.sendTelegramMessage(responseText);
      return { success: true, message: responseText, data: result.record };
    }

    if (parsed.type === 'JOURNEY') {
      const result = await this.journeysService.createJourney(userId, {
        destination: parsed.data.destination,
        budget: parsed.data.budget,
      });
      const responseText = `✈️ Planned Trip to ${result.destination} with budget ₹${result.budget.toLocaleString()}`;
      await this.sendTelegramMessage(responseText);
      return { success: true, message: responseText, data: result };
    }

    if (parsed.type === 'PURCHASE') {
      let responseText = '';
      let data: any = null;

      if (parsed.data.isSavings) {
        const purchases = await this.purchasesService.getPurchases(userId);
        const match = purchases.find(p => p.itemName.toLowerCase().includes(parsed.data.itemName.toLowerCase()) || parsed.data.itemName.toLowerCase().includes(p.itemName.toLowerCase()));

        if (match && match.id) {
          const result = await this.purchasesService.addSavings(userId, match.id, parsed.data.amount);
          const percent = ((result.savedAmount / result.targetAmount) * 100).toFixed(1);
          responseText = `🎯 Added savings of ₹${parsed.data.amount.toLocaleString()} for "${result.itemName}". Total saved: ₹${result.savedAmount.toLocaleString()} / ₹${result.targetAmount.toLocaleString()} (${percent}%)`;
          data = result;
        } else {
          const result = await this.purchasesService.createPurchase(userId, {
            itemName: parsed.data.itemName,
            targetAmount: parsed.data.amount * 2,
            savedAmount: parsed.data.amount,
          });
          responseText = `🎯 Created new Purchase Goal "${result.itemName}" with savings of ₹${result.savedAmount.toLocaleString()} (Target: ₹${result.targetAmount.toLocaleString()})`;
          data = result;
        }
      } else {
        const result = await this.purchasesService.createPurchase(userId, {
          itemName: parsed.data.itemName,
          targetAmount: parsed.data.amount,
          savedAmount: 0,
        });
        responseText = `🎯 Created Purchase Goal: "${result.itemName}" (Target: ₹${result.targetAmount.toLocaleString()})`;
        data = result;
      }

      await this.sendTelegramMessage(responseText);
      return { success: true, message: responseText, data };
    }

    if (parsed.type === 'AI_QUERY') {
      const answer = await this.aiService.resolveQuery(userId, parsed.data.queryText);
      await this.sendTelegramMessage(answer);
      return { success: true, message: answer, data: { answer } };
    }

    const errorText = `❓ Unknown command: "${messageText}". Try: in, out, task verify GRN, expense 250 lunch, trip ooty 25000, buy laptop 50000, ask what is my balance`;
    await this.sendTelegramMessage(errorText);
    return { success: false, message: errorText };
  }

  // Compile Morning Briefing (Pending Attendance, Today's Tasks, Meetings, EMI dues)
  async getMorningBriefing(userId: string): Promise<string> {
    const today = new Date();
    
    // 1. Attendance status check
    const attStatus = await this.attendanceService.getTodayStatus(userId);
    const attText = attStatus.checkedIn 
      ? `✅ Checked in at ${new Date(attStatus.record.checkedInAt).toLocaleTimeString()}`
      : `⚠️ <b>ATTENDANCE PENDING</b> — Please check in! (/in or /wfh)`;

    // 2. Today's Tasks
    const allTasks = await this.tasksService.getTasks(userId);
    const openTasks = allTasks.filter(t => t.status !== 'COMPLETED');
    const tasksHeader = openTasks.length > 0 
      ? `📝 <b>Today's Tasks (${openTasks.length} pending):</b>\n` + openTasks.map((t, idx) => `${idx + 1}. [${t.priority}] ${t.title}`).join('\n')
      : `🎉 No pending tasks for today!`;

    // 3. Meetings
    const events = await this.calendarService.getEvents(userId);
    const todayEvents = events.filter(e => {
      const start = new Date(e.startTime);
      return start.toDateString() === today.toDateString() && e.category === 'MEETING';
    });
    
    const meetingsText = todayEvents.length > 0
      ? `📅 <b>Today's Meetings:</b>\n` + todayEvents.map(e => {
          const time = new Date(e.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `• ${time} - ${e.title} (${e.location || 'Online'})`;
        }).join('\n')
      : `📅 No meetings scheduled for today.`;

    // 4. EMI Dues
    const emis = await this.emiService.getEmis(userId);
    const dueEmis = emis.filter(e => {
      const due = new Date(e.dueDate);
      due.setHours(0,0,0,0);
      const todayZero = new Date(today);
      todayZero.setHours(0,0,0,0);
      const diffTime = due.getTime() - todayZero.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    });

    let emiText = '💳 <b>EMI Notice:</b> No EMIs due in the next 7 days.';
    if (dueEmis.length > 0) {
      emiText = `💳 <b>EMI Notice:</b>\n` + dueEmis.map(e => {
        const due = new Date(e.dueDate);
        due.setHours(0,0,0,0);
        const todayZero = new Date(today);
        todayZero.setHours(0,0,0,0);
        const diffDays = Math.round((due.getTime() - todayZero.getTime()) / (1000 * 60 * 60 * 24));
        const dayLabel = diffDays === 0 ? 'today' : diffDays === 1 ? 'tomorrow' : `in ${diffDays} days`;
        return `• ${e.loanName} of ₹${e.amount.toLocaleString()} due ${dayLabel} (${e.remainingMonths}/${e.totalMonths} months left)`;
      }).join('\n');
    }

    // 5. Journey / Trip updates
    const journeys = await this.journeysService.getJourneys(userId);
    let journeyText = '';
    if (journeys.length > 0) {
      const activeJourney = journeys[0];
      let checklistItems: any[] = [];
      try {
        checklistItems = JSON.parse(activeJourney.checklist);
      } catch (e) {}
      const doneCount = checklistItems.filter(item => item.done).length;
      const totalCount = checklistItems.length;
      const checkPercent = totalCount > 0 ? ((doneCount / totalCount) * 100).toFixed(0) : '0';
      journeyText = `\n\n✈️ <b>Next Journey:</b> ${activeJourney.destination} (Budget: ₹${activeJourney.budget.toLocaleString()})\n  Checklist: ${doneCount}/${totalCount} completed (${checkPercent}%)`;
    }

    // 6. Purchase Goals updates
    const purchases = await this.purchasesService.getPurchases(userId);
    let purchaseText = '';
    if (purchases.length > 0) {
      const sortedPurchases = [...purchases].sort((a, b) => {
        const leftA = a.targetAmount - a.savedAmount;
        const leftB = b.targetAmount - b.savedAmount;
        return leftA - leftB;
      });
      const topPurchase = sortedPurchases[0];
      const pPercent = ((topPurchase.savedAmount / topPurchase.targetAmount) * 100).toFixed(0);
      purchaseText = `\n\n🎯 <b>Top Purchase Goal:</b> ${topPurchase.itemName} — Saved ₹${topPurchase.savedAmount.toLocaleString()} / ₹${topPurchase.targetAmount.toLocaleString()} (${pPercent}%)`;
    }

    return `☀️ <b>MORNING BRIEFING — GSUITE 360</b>\n\n${attText}\n\n${tasksHeader}\n\n${meetingsText}\n\n${emiText}${journeyText}${purchaseText}`;
  }

  // Compile Evening Summary (Work Hours, Expenses, Pending Tasks)
  async getEveningSummary(userId: string): Promise<string> {
    const today = new Date();
    
    // 1. Logged Work Hours
    const attStatus = await this.attendanceService.getTodayStatus(userId);
    let workHoursText = `⚠️ Did not check in today.`;
    if (attStatus.checkedIn) {
      const rec = attStatus.record;
      workHoursText = `⏰ <b>Work hours logged:</b> ${rec.totalHours} hrs (Break: ${rec.breakMinutes} min, OT: ${rec.otHours} hrs)`;
    }

    // 2. Today's Expenses
    const expenses = await this.expensesService.getExpenses(userId);
    const todayExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d.toDateString() === today.toDateString();
    });
    const totalExp = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    let expenseText = `💸 <b>Expenses Today:</b> ₹0 logged.`;
    if (todayExpenses.length > 0) {
      const listText = todayExpenses.map(e => `₹${e.amount} (${e.description})`).join(', ');
      expenseText = `💸 <b>Expenses Today:</b> ${listText} — Total: ₹${totalExp.toLocaleString()}.`;
    }

    // 3. Remaining Tasks
    const allTasks = await this.tasksService.getTasks(userId);
    const openTasks = allTasks.filter(t => t.status !== 'COMPLETED');
    const pendingTasksText = openTasks.length > 0
      ? `📝 <b>Remaining Tasks (${openTasks.length}):</b>\n` + openTasks.map((t, idx) => `• ${t.title}`).join('\n')
      : `🎉 All tasks completed today!`;

    return `🌙 <b>EVENING SUMMARY — GSUITE 360</b>\n\n${workHoursText}\n\n${expenseText}\n\n${pendingTasksText}`;
  }

  // Dispatches briefings to Telegram
  async dispatchMorningBriefing(userId: string): Promise<boolean> {
    const text = await this.getMorningBriefing(userId);
    return this.sendTelegramMessage(text);
  }

  async dispatchEveningSummary(userId: string): Promise<boolean> {
    const text = await this.getEveningSummary(userId);
    return this.sendTelegramMessage(text);
  }
}
