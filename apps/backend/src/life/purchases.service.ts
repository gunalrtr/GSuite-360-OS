import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PurchaseGoalData {
  id?: string;
  itemName: string;
  targetAmount: number;
  savedAmount: number;
  targetDate?: Date;
  createdAt?: Date;
}

@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);

  // In-memory fallback dataset
  private mockPurchases: PurchaseGoalData[] = [];

  constructor(private readonly prisma: PrismaService) {
    this.seedMockPurchases();
  }

  private seedMockPurchases() {
    const today = new Date();
    const target1 = new Date(today);
    target1.setMonth(today.getMonth() + 3);
    const target2 = new Date(today);
    target2.setMonth(today.getMonth() + 6);

    this.mockPurchases = [
      {
        id: 'purchase-macbook-001',
        itemName: 'MacBook Pro 14"',
        targetAmount: 150000,
        savedAmount: 60000,
        targetDate: target1,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'purchase-scooter-002',
        itemName: 'Electric Scooter (Ola S1)',
        targetAmount: 120000,
        savedAmount: 45000,
        targetDate: target2,
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      },
    ];
  }

  async getPurchases(userId: string): Promise<PurchaseGoalData[]> {
    try {
      const purchases = await this.prisma.purchaseGoal.findMany({
        where: { userId },
        orderBy: { itemName: 'asc' },
      });
      if (purchases.length > 0) {
        return purchases.map(p => ({
          id: p.id,
          itemName: p.itemName,
          targetAmount: p.targetAmount,
          savedAmount: p.savedAmount,
          targetDate: p.targetDate || undefined,
          createdAt: p.createdAt,
        }));
      }
    } catch (error) {
      this.logger.warn(`getPurchases: DB error, using memory fallback: ${error instanceof Error ? error.message : String(error)}`);
    }
    return [...this.mockPurchases];
  }

  async createPurchase(userId: string, data: Partial<PurchaseGoalData>): Promise<PurchaseGoalData> {
    const itemName = data.itemName || 'New Purchase Goal';
    const targetAmount = data.targetAmount || 10000;
    const savedAmount = data.savedAmount || 0;
    const targetDate = data.targetDate ? new Date(data.targetDate) : undefined;

    try {
      const p = await this.prisma.purchaseGoal.create({
        data: {
          userId,
          itemName,
          targetAmount,
          savedAmount,
          targetDate,
        },
      });
      return {
        id: p.id,
        itemName: p.itemName,
        targetAmount: p.targetAmount,
        savedAmount: p.savedAmount,
        targetDate: p.targetDate || undefined,
        createdAt: p.createdAt,
      };
    } catch (error) {
      this.logger.warn(`createPurchase: DB error, adding to memory fallback: ${error instanceof Error ? error.message : String(error)}`);
      const newPurchase: PurchaseGoalData = {
        id: `purchase-custom-${Date.now()}`,
        itemName,
        targetAmount,
        savedAmount,
        targetDate,
        createdAt: new Date(),
      };
      this.mockPurchases.push(newPurchase);
      return newPurchase;
    }
  }

  async addSavings(userId: string, purchaseId: string, amount: number): Promise<PurchaseGoalData> {
    try {
      // Find item
      const goal = await this.prisma.purchaseGoal.findFirst({
        where: { id: purchaseId, userId },
      });
      if (goal) {
        const updated = await this.prisma.purchaseGoal.update({
          where: { id: purchaseId },
          data: { savedAmount: goal.savedAmount + amount },
        });
        return {
          id: updated.id,
          itemName: updated.itemName,
          targetAmount: updated.targetAmount,
          savedAmount: updated.savedAmount,
          targetDate: updated.targetDate || undefined,
          createdAt: updated.createdAt,
        };
      }
    } catch (error) {
      this.logger.warn(`addSavings: DB error, updating memory fallback: ${error instanceof Error ? error.message : String(error)}`);
    }

    const index = this.mockPurchases.findIndex(p => p.id === purchaseId);
    if (index !== -1) {
      this.mockPurchases[index].savedAmount += amount;
      return this.mockPurchases[index];
    }
    throw new Error('Purchase goal not found');
  }
}
