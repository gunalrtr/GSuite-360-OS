import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetsService } from './budgets.service';

export interface ExpenseRecord {
  id: string;
  userId: string;
  amount: number;
  description: string;
  category: string;
  date: Date;
}

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  // In-memory fallback dataset
  private inMemoryExpenses: ExpenseRecord[] = [];

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => BudgetsService))
    private readonly budgetsService: BudgetsService
  ) {
    this.seedMockExpenses();
  }

  private seedMockExpenses() {
    const today = new Date();
    const userId = 'mock-user-uuid-1234-5678';

    const t1 = new Date(today);
    t1.setHours(13, 15, 0, 0); // Lunch today
    
    const t2 = new Date(today);
    t2.setHours(17, 30, 0, 0); // Tea today

    const t3 = new Date(today);
    t3.setDate(today.getDate() - 1); // Fuel yesterday

    const t4 = new Date(today);
    t4.setDate(today.getDate() - 2); // Shopping 2 days ago

    this.inMemoryExpenses.push(
      {
        id: 'exp-mock-1',
        userId,
        amount: 250,
        description: 'Swiggy Lunch',
        category: 'Food',
        date: t1,
      },
      {
        id: 'exp-mock-2',
        userId,
        amount: 40,
        description: 'Tea with team',
        category: 'Food',
        date: t2,
      },
      {
        id: 'exp-mock-3',
        userId,
        amount: 1500,
        description: 'Shell Petrol Full Tank',
        category: 'Fuel',
        date: t3,
      },
      {
        id: 'exp-mock-4',
        userId,
        amount: 800,
        description: 'Cotton T-shirt buy',
        category: 'Shopping',
        date: t4,
      }
    );
  }

  async getExpenses(userId: string): Promise<ExpenseRecord[]> {
    try {
      const dbExpenses = await this.prisma.expense.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
      });
      if (dbExpenses.length > 0) {
        return dbExpenses.map(e => ({
          id: e.id,
          userId: e.userId,
          amount: e.amount,
          description: e.description,
          category: e.category,
          date: e.date,
        }));
      }
    } catch (error) {
      this.logger.warn(`getExpenses: Database offline/query failed, returning mock expenses. Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return [...this.inMemoryExpenses]
      .filter(e => e.userId === userId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async createExpense(userId: string, data: { amount: number; description: string; category: string; date?: string }): Promise<any> {
    const amount = data.amount;
    const description = data.description;
    const category = data.category || 'Shopping';
    const date = data.date ? new Date(data.date) : new Date();

    let createdRecord: ExpenseRecord;
    let dbMode = true;

    try {
      const e = await this.prisma.expense.create({
        data: { userId, amount, description, category, date },
      });
      createdRecord = {
        id: e.id,
        userId: e.userId,
        amount: e.amount,
        description: e.description,
        category: e.category,
        date: e.date,
      };
    } catch (error) {
      this.logger.warn(`createExpense: Database create failed, using memory fallback. Error: ${error instanceof Error ? error.message : String(error)}`);
      dbMode = false;
      createdRecord = {
        id: `exp-custom-${Date.now()}`,
        userId,
        amount,
        description,
        category,
        date,
      };
      this.inMemoryExpenses.push(createdRecord);
    }

    // Perform budget limit check
    const budget = await this.budgetsService.getBudgetByCategory(userId, category);
    let budgetWarning = false;
    let budgetMessage = '';

    if (budget) {
      const today = new Date();
      const month = today.getMonth() + 1;
      const year = today.getFullYear();
      
      // Calculate category sum for current month
      let categoryTotal = 0;
      if (dbMode) {
        try {
          const startOfMonth = new Date(year, month - 1, 1);
          const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
          
          const aggregations = await this.prisma.expense.aggregate({
            _sum: { amount: true },
            where: {
              userId,
              category,
              date: {
                gte: startOfMonth,
                lte: endOfMonth,
              },
            },
          });
          categoryTotal = aggregations._sum.amount || 0;
        } catch (err) {
          // fallback inline calculation if aggregate fails
          const monthly = this.inMemoryExpenses.filter(e => {
            const d = new Date(e.date);
            return e.userId === userId && e.category.toLowerCase() === category.toLowerCase() && (d.getMonth() + 1) === month && d.getFullYear() === year;
          });
          categoryTotal = monthly.reduce((sum, e) => sum + e.amount, 0);
        }
      } else {
        const monthly = this.inMemoryExpenses.filter(e => {
          const d = new Date(e.date);
          return e.userId === userId && e.category.toLowerCase() === category.toLowerCase() && (d.getMonth() + 1) === month && d.getFullYear() === year;
        });
        categoryTotal = monthly.reduce((sum, e) => sum + e.amount, 0);
      }

      const percentageUsed = parseFloat(((categoryTotal / budget.limit) * 100).toFixed(1));
      if (percentageUsed >= 85) {
        budgetWarning = true;
        budgetMessage = `Warning: ${category} budget is at ${percentageUsed}% (₹${categoryTotal.toLocaleString()}/₹${budget.limit.toLocaleString()})`;
      }
    }

    return {
      success: true,
      record: createdRecord,
      budgetWarning,
      budgetMessage,
    };
  }

  async deleteExpense(userId: string, expenseId: string): Promise<boolean> {
    try {
      await this.prisma.expense.delete({
        where: { id: expenseId },
      });
      return true;
    } catch (error) {
      this.logger.warn(`deleteExpense: Database delete failed, removing from memory fallback. Error: ${error instanceof Error ? error.message : String(error)}`);
      const index = this.inMemoryExpenses.findIndex(e => e.id === expenseId && e.userId === userId);
      if (index !== -1) {
        this.inMemoryExpenses.splice(index, 1);
        return true;
      }
      return false;
    }
  }
}
