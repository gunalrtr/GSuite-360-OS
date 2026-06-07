import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SipRecord {
  id: string;
  userId: string;
  fundName: string;
  amount: number;
  investmentDate: number; // Day of month (e.g. 10th)
}

@Injectable()
export class SipService {
  private readonly logger = new Logger(SipService.name);

  // In-memory fallback database
  private inMemorySips: SipRecord[] = [];

  constructor(private readonly prisma: PrismaService) {
    this.seedMockSips();
  }

  private seedMockSips() {
    const userId = 'mock-user-uuid-1234-5678';
    this.inMemorySips.push(
      {
        id: 'sip-mock-1',
        userId,
        fundName: 'Quant Active Fund Growth',
        amount: 5000,
        investmentDate: 10,
      },
      {
        id: 'sip-mock-2',
        userId,
        fundName: 'Parag Parikh Flexi Cap Direct Growth',
        amount: 3000,
        investmentDate: 15,
      }
    );
  }

  async getSips(userId: string): Promise<SipRecord[]> {
    try {
      const dbSips = await this.prisma.sIP.findMany({
        where: { userId },
        orderBy: { investmentDate: 'asc' },
      });
      if (dbSips.length > 0) {
        return dbSips.map(s => ({
          id: s.id,
          userId: s.userId,
          fundName: s.fundName,
          amount: s.amount,
          investmentDate: s.investmentDate,
        }));
      }
    } catch (error) {
      this.logger.warn(`getSips: Database offline/query failed, returning mock SIPs. Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return [...this.inMemorySips].filter(s => s.userId === userId);
  }

  async createSip(userId: string, data: { fundName: string; amount: number; investmentDate: number }): Promise<SipRecord> {
    const fundName = data.fundName;
    const amount = data.amount;
    const investmentDate = data.investmentDate || 5;

    try {
      const sip = await this.prisma.sIP.create({
        data: { userId, fundName, amount, investmentDate },
      });
      return {
        id: sip.id,
        userId: sip.userId,
        fundName: sip.fundName,
        amount: sip.amount,
        investmentDate: sip.investmentDate,
      };
    } catch (error) {
      this.logger.warn(`createSip: Database save failed, creating in memory. Error: ${error instanceof Error ? error.message : String(error)}`);
      const newSip: SipRecord = {
        id: `sip-custom-${Date.now()}`,
        userId,
        fundName,
        amount,
        investmentDate,
      };
      this.inMemorySips.push(newSip);
      return newSip;
    }
  }

  async deleteSip(userId: string, sipId: string): Promise<boolean> {
    try {
      await this.prisma.sIP.delete({
        where: { id: sipId },
      });
      return true;
    } catch (error) {
      this.logger.warn(`deleteSip: Database delete failed, removing from memory. Error: ${error instanceof Error ? error.message : String(error)}`);
      const index = this.inMemorySips.findIndex(s => s.id === sipId && s.userId === userId);
      if (index !== -1) {
        this.inMemorySips.splice(index, 1);
        return true;
      }
      return false;
    }
  }
}
