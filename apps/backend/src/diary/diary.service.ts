import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface WorkDiaryRecord {
  id: string;
  userId: string;
  date: Date;
  whatIDid: string;
  issuesFaced?: string | null;
  learnings?: string | null;
  notes?: string | null;
  tomorrowPlan?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DiaryService {
  private readonly logger = new Logger(DiaryService.name);

  // In-memory fallback
  private inMemoryDiaries: WorkDiaryRecord[] = [];

  constructor(private readonly prisma: PrismaService) {
    this.seedMockDiaries();
  }

  private seedMockDiaries() {
    const userId = 'mock-user-uuid-1234-5678';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Seed diaries for the last few days
    for (let i = 1; i <= 5; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      if (d.getDay() === 0 || d.getDay() === 6) continue;

      this.inMemoryDiaries.push({
        id: `diary-mock-${i}`,
        userId,
        date: d,
        whatIDid: `Processed ${10 + i} GRNs, verified pending PO list, and generated daily Tally MIS reports.`,
        issuesFaced: i === 2 ? 'Network lag slowed down GRN postings in the store portal.' : undefined,
        learnings: 'Learned the new stock reconciliation shortcuts in Tally Prime.',
        notes: 'Stock verification is healthy. Discrepancy under 0.1%.',
        tomorrowPlan: `- Verify pending PO from suppliers\n- Post stock entries\n- Process new incoming vehicles`,
        createdAt: d,
        updatedAt: d,
      });
    }
  }

  async getDiaryByDate(userId: string, dateStr: string): Promise<WorkDiaryRecord | null> {
    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);

    try {
      const record = await this.prisma.workDiary.findUnique({
        where: {
          userId_date: { userId, date: targetDate },
        },
      });
      return record || null;
    } catch (error) {
      this.logger.warn(`getDiaryByDate: Database lookup failed, falling back to memory. Error: ${error instanceof Error ? error.message : String(error)}`);
      
      const record = this.inMemoryDiaries.find(
        d => d.userId === userId && d.date.getTime() === targetDate.getTime()
      );
      return record || null;
    }
  }

  async saveDiary(userId: string, dateStr: string, data: Partial<WorkDiaryRecord>): Promise<WorkDiaryRecord> {
    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);

    const whatIDid = data.whatIDid || '';
    const issuesFaced = data.issuesFaced || '';
    const learnings = data.learnings || '';
    const notes = data.notes || '';
    const tomorrowPlan = data.tomorrowPlan || '';

    try {
      const record = await this.prisma.workDiary.upsert({
        where: {
          userId_date: { userId, date: targetDate },
        },
        update: {
          whatIDid,
          issuesFaced,
          learnings,
          notes,
          tomorrowPlan,
        },
        create: {
          userId,
          date: targetDate,
          whatIDid,
          issuesFaced,
          learnings,
          notes,
          tomorrowPlan,
        },
      });
      return record;
    } catch (error) {
      this.logger.warn(`saveDiary: Database save failed, writing to memory. Error: ${error instanceof Error ? error.message : String(error)}`);
      
      let record = this.inMemoryDiaries.find(
        d => d.userId === userId && d.date.getTime() === targetDate.getTime()
      );

      if (record) {
        record.whatIDid = whatIDid;
        record.issuesFaced = issuesFaced;
        record.learnings = learnings;
        record.notes = notes;
        record.tomorrowPlan = tomorrowPlan;
        record.updatedAt = new Date();
      } else {
        record = {
          id: `diary-sess-${Date.now()}`,
          userId,
          date: targetDate,
          whatIDid,
          issuesFaced,
          learnings,
          notes,
          tomorrowPlan,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.inMemoryDiaries.push(record);
      }
      return record;
    }
  }

  async getRecentDiaries(userId: string, limit = 10): Promise<WorkDiaryRecord[]> {
    try {
      const records = await this.prisma.workDiary.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: limit,
      });
      return records;
    } catch (error) {
      this.logger.warn(`getRecentDiaries: Database query failed, using memory. Error: ${error instanceof Error ? error.message : String(error)}`);
      return [...this.inMemoryDiaries]
        .filter(d => d.userId === userId)
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, limit);
    }
  }
}
