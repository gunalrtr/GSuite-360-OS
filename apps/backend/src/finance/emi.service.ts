import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface EmiRecord {
  id: string;
  userId: string;
  loanName: string;
  amount: number;
  dueDate: Date;
  remainingMonths: number;
  totalMonths: number;
}

@Injectable()
export class EmiService {
  private readonly logger = new Logger(EmiService.name);

  // In-memory fallback database
  private inMemoryEmis: EmiRecord[] = [];

  constructor(private readonly prisma: PrismaService) {
    this.seedMockEmis();
  }

  private seedMockEmis() {
    const userId = 'mock-user-uuid-1234-5678';
    
    // Set next HDFC loan due date to be on the 10th of the current month
    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth(); // 0-11
    
    // If today is past the 10th, set it to the 10th of next month
    if (today.getDate() > 10) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    
    const dueDate = new Date(year, month, 10, 10, 0, 0, 0);

    this.inMemoryEmis.push({
      id: 'emi-mock-1',
      userId,
      loanName: 'HDFC Car Loan EMI',
      amount: 12500,
      dueDate,
      remainingMonths: 24,
      totalMonths: 36,
    });
  }

  async getEmis(userId: string): Promise<EmiRecord[]> {
    try {
      const dbEmis = await this.prisma.eMI.findMany({
        where: { userId },
        orderBy: { dueDate: 'asc' },
      });
      if (dbEmis.length > 0) {
        return dbEmis.map(e => ({
          id: e.id,
          userId: e.userId,
          loanName: e.loanName,
          amount: e.amount,
          dueDate: e.dueDate,
          remainingMonths: e.remainingMonths,
          totalMonths: e.totalMonths,
        }));
      }
    } catch (error) {
      this.logger.warn(`getEmis: Database offline/query failed, returning mock EMIs. Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return [...this.inMemoryEmis].filter(e => e.userId === userId);
  }

  async createEmi(userId: string, data: { loanName: string; amount: number; dueDate: string; remainingMonths: number; totalMonths: number }): Promise<EmiRecord> {
    const loanName = data.loanName;
    const amount = data.amount;
    const dueDate = new Date(data.dueDate);
    const remainingMonths = data.remainingMonths || 12;
    const totalMonths = data.totalMonths || 12;

    try {
      const emi = await this.prisma.eMI.create({
        data: { userId, loanName, amount, dueDate, remainingMonths, totalMonths },
      });
      return {
        id: emi.id,
        userId: emi.userId,
        loanName: emi.loanName,
        amount: emi.amount,
        dueDate: emi.dueDate,
        remainingMonths: emi.remainingMonths,
        totalMonths: emi.totalMonths,
      };
    } catch (error) {
      this.logger.warn(`createEmi: Database save failed, creating in memory. Error: ${error instanceof Error ? error.message : String(error)}`);
      const newEmi: EmiRecord = {
        id: `emi-custom-${Date.now()}`,
        userId,
        loanName,
        amount,
        dueDate,
        remainingMonths,
        totalMonths,
      };
      this.inMemoryEmis.push(newEmi);
      return newEmi;
    }
  }

  async deleteEmi(userId: string, emiId: string): Promise<boolean> {
    try {
      await this.prisma.eMI.delete({
        where: { id: emiId },
      });
      return true;
    } catch (error) {
      this.logger.warn(`deleteEmi: Database delete failed, removing from memory. Error: ${error instanceof Error ? error.message : String(error)}`);
      const index = this.inMemoryEmis.findIndex(e => e.id === emiId && e.userId === userId);
      if (index !== -1) {
        this.inMemoryEmis.splice(index, 1);
        return true;
      }
      return false;
    }
  }
}
