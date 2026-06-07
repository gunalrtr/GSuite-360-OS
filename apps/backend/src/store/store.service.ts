import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface StoreLogData {
  id?: string;
  date: Date;
  grnCount: number;
  poCount: number;
  vehicleEntries: number;
  materialReceipts: number;
  stockVerifications: number;
  notes?: string;
  createdAt?: Date;
}

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);

  // In-memory fallback dataset
  private mockStoreLogs: StoreLogData[] = [];

  constructor(private readonly prisma: PrismaService) {
    this.seedMockStoreLogs();
  }

  private seedMockStoreLogs() {
    const today = new Date();
    this.mockStoreLogs = [];

    // Seed 7 days of historical logs
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      d.setHours(0, 0, 0, 0);

      this.mockStoreLogs.push({
        id: `store-mock-${d.getDate()}`,
        date: d,
        grnCount: Math.floor(Math.random() * 10) + 12, // 12-22 GRNs
        poCount: Math.floor(Math.random() * 8) + 10,   // 10-18 POs
        vehicleEntries: Math.floor(Math.random() * 15) + 20, // 20-35 vehicles
        materialReceipts: Math.floor(Math.random() * 20) + 25, // 25-45 receipts
        stockVerifications: Math.floor(Math.random() * 5) + 5, // 5-10 aisles checked
        notes: `Operational logs for ${d.toLocaleDateString()}`,
        createdAt: new Date(d),
      });
    }
  }

  async getStoreLogs(userId: string): Promise<StoreLogData[]> {
    try {
      const logs = await this.prisma.storeLog.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
      });
      if (logs.length > 0) {
        return logs.map(l => ({
          id: l.id,
          date: l.date,
          grnCount: l.grnCount,
          poCount: l.poCount,
          vehicleEntries: l.vehicleEntries,
          materialReceipts: l.materialReceipts,
          stockVerifications: l.stockVerifications,
          notes: l.notes || undefined,
          createdAt: l.createdAt,
        }));
      }
    } catch (error) {
      this.logger.warn(`getStoreLogs: DB check failed, using memory fallback: ${error instanceof Error ? error.message : String(error)}`);
    }
    return [...this.mockStoreLogs].sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async createStoreLog(userId: string, data: Partial<StoreLogData>): Promise<StoreLogData> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const logDate = data.date ? new Date(data.date) : today;
    logDate.setHours(0, 0, 0, 0);

    const grnCount = data.grnCount || 0;
    const poCount = data.poCount || 0;
    const vehicleEntries = data.vehicleEntries || 0;
    const materialReceipts = data.materialReceipts || 0;
    const stockVerifications = data.stockVerifications || 0;
    const notes = data.notes || '';

    try {
      // Upsert to ensure one record per day per user
      const l = await this.prisma.storeLog.upsert({
        where: {
          userId_date: {
            userId,
            date: logDate,
          },
        },
        update: {
          grnCount,
          poCount,
          vehicleEntries,
          materialReceipts,
          stockVerifications,
          notes,
        },
        create: {
          userId,
          date: logDate,
          grnCount,
          poCount,
          vehicleEntries,
          materialReceipts,
          stockVerifications,
          notes,
        },
      });
      return {
        id: l.id,
        date: l.date,
        grnCount: l.grnCount,
        poCount: l.poCount,
        vehicleEntries: l.vehicleEntries,
        materialReceipts: l.materialReceipts,
        stockVerifications: l.stockVerifications,
        notes: l.notes || undefined,
        createdAt: l.createdAt,
      };
    } catch (error) {
      this.logger.warn(`createStoreLog: DB check failed, writing to memory fallback: ${error instanceof Error ? error.message : String(error)}`);
      
      const existingIdx = this.mockStoreLogs.findIndex(l => l.date.getTime() === logDate.getTime());
      const newLog: StoreLogData = {
        id: existingIdx !== -1 ? this.mockStoreLogs[existingIdx].id : `store-custom-${Date.now()}`,
        date: logDate,
        grnCount,
        poCount,
        vehicleEntries,
        materialReceipts,
        stockVerifications,
        notes,
        createdAt: new Date(),
      };

      if (existingIdx !== -1) {
        this.mockStoreLogs[existingIdx] = newLog;
      } else {
        this.mockStoreLogs.push(newLog);
      }
      return newLog;
    }
  }

  async getKPIs(userId: string): Promise<any> {
    const logs = await this.getStoreLogs(userId);
    if (logs.length === 0) {
      return {
        efficiencyRatio: 0,
        averageVehicles: 0,
        totalMaterialReceipts: 0,
        reconciliationScore: 0,
      };
    }

    // Calculate averages and ratios
    let totalGrn = 0;
    let totalPo = 0;
    let totalVehicles = 0;
    let totalReceipts = 0;
    let totalChecks = 0;

    logs.forEach(l => {
      totalGrn += l.grnCount;
      totalPo += l.poCount;
      totalVehicles += l.vehicleEntries;
      totalReceipts += l.materialReceipts;
      totalChecks += l.stockVerifications;
    });

    const efficiencyRatio = totalPo > 0 ? (totalGrn / totalPo) * 100 : 0;
    const averageVehicles = totalVehicles / logs.length;
    const reconciliationScore = totalChecks > 0 ? (totalChecks * 15) : 0; // arbitrary score rating count

    return {
      efficiencyRatio: parseFloat(efficiencyRatio.toFixed(1)),
      averageVehicles: parseFloat(averageVehicles.toFixed(1)),
      totalMaterialReceipts: totalReceipts,
      reconciliationScore: Math.min(100, reconciliationScore), // cap at 100
    };
  }
}
