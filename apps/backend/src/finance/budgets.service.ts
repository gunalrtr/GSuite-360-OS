import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface BudgetRecord {
  id: string;
  userId: string;
  category: string;
  limit: number;
  month: number;
  year: number;
}

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  // In-memory fallback dataset
  private inMemoryBudgets: BudgetRecord[] = [];

  constructor(private readonly prisma: PrismaService) {
    this.seedMockBudgets();
  }

  private seedMockBudgets() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const userId = 'mock-user-uuid-1234-5678';

    const categories = [
      { category: 'Food', limit: 5000 },
      { category: 'Fuel', limit: 3000 },
      { category: 'Bills', limit: 10000 },
      { category: 'Medical', limit: 2000 },
      { category: 'Shopping', limit: 4000 },
      { category: 'Travel', limit: 3500 },
    ];

    categories.forEach((c, idx) => {
      this.inMemoryBudgets.push({
        id: `budget-mock-${idx}`,
        userId,
        category: c.category,
        limit: c.limit,
        month,
        year,
      });
    });
  }

  async getBudgets(userId: string): Promise<BudgetRecord[]> {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    try {
      const dbBudgets = await this.prisma.budget.findMany({
        where: { userId, month, year },
      });
      if (dbBudgets.length > 0) {
        return dbBudgets.map(b => ({
          id: b.id,
          userId: b.userId,
          category: b.category,
          limit: b.limit,
          month: b.month,
          year: b.year,
        }));
      }
    } catch (error) {
      this.logger.warn(`getBudgets: Database/Prisma check failed, returning mock budgets. Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return this.inMemoryBudgets.filter(b => b.userId === userId && b.month === month && b.year === year);
  }

  async getBudgetByCategory(userId: string, category: string): Promise<BudgetRecord | null> {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    try {
      const b = await this.prisma.budget.findUnique({
        where: {
          userId_category_month_year: { userId, category, month, year },
        },
      });
      if (b) return b;
    } catch (error) {
      this.logger.warn(`getBudgetByCategory: Database query failed, using memory fallback. Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    const memBudget = this.inMemoryBudgets.find(
      b => b.userId === userId && b.category.toLowerCase() === category.toLowerCase() && b.month === month && b.year === year
    );
    return memBudget || null;
  }

  async updateBudget(userId: string, category: string, limit: number): Promise<BudgetRecord> {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    try {
      const b = await this.prisma.budget.upsert({
        where: {
          userId_category_month_year: { userId, category, month, year },
        },
        update: { limit },
        create: { userId, category, limit, month, year },
      });
      return b;
    } catch (error) {
      this.logger.warn(`updateBudget: Database save failed, writing to memory fallback. Error: ${error instanceof Error ? error.message : String(error)}`);
      
      let memBudget = this.inMemoryBudgets.find(
        b => b.userId === userId && b.category.toLowerCase() === category.toLowerCase() && b.month === month && b.year === year
      );

      if (memBudget) {
        memBudget.limit = limit;
      } else {
        memBudget = {
          id: `budget-custom-${Date.now()}`,
          userId,
          category,
          limit,
          month,
          year,
        };
        this.inMemoryBudgets.push(memBudget);
      }
      return memBudget;
    }
  }
}
