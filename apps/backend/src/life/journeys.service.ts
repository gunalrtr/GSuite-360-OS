import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface JourneyData {
  id?: string;
  destination: string;
  budget: number;
  startDate: Date;
  endDate: Date;
  checklist: string; // JSON string
  createdAt?: Date;
}

@Injectable()
export class JourneysService {
  private readonly logger = new Logger(JourneysService.name);

  // In-memory fallback dataset
  private mockJourneys: JourneyData[] = [];

  constructor(private readonly prisma: PrismaService) {
    this.seedMockJourneys();
  }

  private seedMockJourneys() {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + 15);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 4);

    const defaultChecklist = [
      { id: 'item-1', text: 'Book Resort in Ooty', done: true },
      { id: 'item-2', text: 'Pack warm jackets & sweaters', done: false },
      { id: 'item-3', text: 'Rent a self-drive car', done: false },
      { id: 'item-4', text: 'Book Pykara lake boating', done: false },
      { id: 'item-5', text: 'Buy home-made chocolates list', done: false },
    ];

    this.mockJourneys = [
      {
        id: 'journey-ooty-123',
        destination: 'Ooty Trip',
        budget: 25000,
        startDate: startDate,
        endDate: endDate,
        checklist: JSON.stringify(defaultChecklist),
        createdAt: new Date(),
      },
    ];
  }

  async getJourneys(userId: string): Promise<JourneyData[]> {
    try {
      const journeys = await this.prisma.journey.findMany({
        where: { userId },
        orderBy: { startDate: 'asc' },
      });
      if (journeys.length > 0) {
        return journeys.map(j => ({
          id: j.id,
          destination: j.destination,
          budget: j.budget,
          startDate: j.startDate,
          endDate: j.endDate,
          checklist: j.checklist,
          createdAt: j.createdAt,
        }));
      }
    } catch (error) {
      this.logger.warn(`getJourneys: DB error, using memory fallback: ${error instanceof Error ? error.message : String(error)}`);
    }
    return [...this.mockJourneys];
  }

  async createJourney(userId: string, data: Partial<JourneyData>): Promise<JourneyData> {
    const destination = data.destination || 'New Journey';
    const budget = data.budget || 10000;
    
    const today = new Date();
    const startDate = data.startDate ? new Date(data.startDate) : new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const endDate = data.endDate ? new Date(data.endDate) : new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000);
    const checklist = data.checklist || '[]';

    try {
      const j = await this.prisma.journey.create({
        data: {
          userId,
          destination,
          budget,
          startDate,
          endDate,
          checklist,
        },
      });
      return {
        id: j.id,
        destination: j.destination,
        budget: j.budget,
        startDate: j.startDate,
        endDate: j.endDate,
        checklist: j.checklist,
        createdAt: j.createdAt,
      };
    } catch (error) {
      this.logger.warn(`createJourney: DB error, adding to memory fallback: ${error instanceof Error ? error.message : String(error)}`);
      const newJourney: JourneyData = {
        id: `journey-custom-${Date.now()}`,
        destination,
        budget,
        startDate,
        endDate,
        checklist,
        createdAt: new Date(),
      };
      this.mockJourneys.push(newJourney);
      return newJourney;
    }
  }

  async updateChecklist(userId: string, journeyId: string, checklistJson: string): Promise<JourneyData> {
    try {
      const j = await this.prisma.journey.update({
        where: { id: journeyId },
        data: { checklist: checklistJson },
      });
      return {
        id: j.id,
        destination: j.destination,
        budget: j.budget,
        startDate: j.startDate,
        endDate: j.endDate,
        checklist: j.checklist,
        createdAt: j.createdAt,
      };
    } catch (error) {
      this.logger.warn(`updateChecklist: DB error, updating memory fallback: ${error instanceof Error ? error.message : String(error)}`);
      const index = this.mockJourneys.findIndex(j => j.id === journeyId);
      if (index !== -1) {
        this.mockJourneys[index].checklist = checklistJson;
        return this.mockJourneys[index];
      }
      throw new Error('Journey not found');
    }
  }
}
