import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  category: 'MEETING' | 'BIRTHDAY' | 'LEAVE' | 'HOLIDAY';
  location?: string;
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  // Seeded mock events
  private mockEvents: CalendarEvent[] = [];

  constructor(private readonly prisma: PrismaService) {
    this.seedMockEvents();
  }

  private seedMockEvents() {
    const today = new Date();
    
    // Meeting 1 (Today)
    const m1Start = new Date(today);
    m1Start.setHours(10, 30, 0, 0);
    const m1End = new Date(today);
    m1End.setHours(11, 30, 0, 0);

    // Meeting 2 (Today)
    const m2Start = new Date(today);
    m2Start.setHours(15, 0, 0, 0);
    const m2End = new Date(today);
    m2End.setHours(15, 45, 0, 0);

    // Birthday (Tomorrow)
    const bStart = new Date(today);
    bStart.setDate(today.getDate() + 1);
    bStart.setHours(9, 0, 0, 0);
    const bEnd = new Date(today);
    bEnd.setDate(today.getDate() + 1);
    bEnd.setHours(18, 0, 0, 0);

    // Meeting 3 (Tomorrow)
    const m3Start = new Date(today);
    m3Start.setDate(today.getDate() + 1);
    m3Start.setHours(14, 0, 0, 0);
    const m3End = new Date(today);
    m3End.setDate(today.getDate() + 1);
    m3End.setHours(15, 0, 0, 0);

    // Project Deadline (In 3 Days)
    const dlStart = new Date(today);
    dlStart.setDate(today.getDate() + 3);
    dlStart.setHours(10, 0, 0, 0);
    const dlEnd = new Date(today);
    dlEnd.setDate(today.getDate() + 3);
    dlEnd.setHours(11, 0, 0, 0);

    this.mockEvents.push(
      {
        id: 'cal-event-1',
        title: 'Supplier GRN Auditing Sync',
        description: 'Verify pending GRNs and match distributor bills.',
        startTime: m1Start,
        endTime: m1End,
        category: 'MEETING',
        location: 'Store Conference Room A',
      },
      {
        id: 'cal-event-2',
        title: 'Tally Prime Integration Review',
        description: 'Syncing local stock ledgers to backend cloud server.',
        startTime: m2Start,
        endTime: m2End,
        category: 'MEETING',
        location: 'Microsoft Teams Link',
      },
      {
        id: 'cal-event-3',
        title: 'Store Executive Aravind Birthday 🎂',
        description: 'Send greetings in Telegram group!',
        startTime: bStart,
        endTime: bEnd,
        category: 'BIRTHDAY',
      },
      {
        id: 'cal-event-4',
        title: 'Monthly stock reconciliation plan',
        description: 'Planning inventory counts for Aisle C & D.',
        startTime: m3Start,
        endTime: m3End,
        category: 'MEETING',
        location: 'Aisle B Office',
      },
      {
        id: 'cal-event-5',
        title: 'Form 16 Tax Filing review',
        description: 'Check HR portal updates.',
        startTime: dlStart,
        endTime: dlEnd,
        category: 'MEETING',
        location: 'HR Desk',
      }
    );
  }

  async getEvents(userId: string): Promise<CalendarEvent[]> {
    try {
      // Direct Query DB for Calendar events if available
      const events = await this.prisma.calendarEvent.findMany({
        where: { userId },
        orderBy: { startTime: 'asc' },
      });
      if (events.length > 0) {
        return events.map(e => ({
          ...e,
          description: e.description || undefined,
          location: e.location || undefined,
          category: e.category as any,
        }));
      }
    } catch (error) {
      this.logger.warn(`getEvents: Database/Google API check failed, returning mock calendar. Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Return sorted mock list
    return [...this.mockEvents].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  async createEvent(userId: string, data: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const title = data.title || 'New Event';
    const description = data.description || '';
    const startTime = data.startTime ? new Date(data.startTime) : new Date();
    const endTime = data.endTime ? new Date(data.endTime) : new Date(startTime.getTime() + 60 * 60 * 1000);
    const category = data.category || 'MEETING';
    const location = data.location || '';

    try {
      const event = await this.prisma.calendarEvent.create({
        data: {
          userId,
          title,
          description,
          startTime,
          endTime,
          category,
          location,
        },
      });
      return {
        ...event,
        description: event.description || undefined,
        location: event.location || undefined,
        category: event.category as any,
      };
    } catch (error) {
      this.logger.warn(`createEvent: Database save failed, adding to mock. Error: ${error instanceof Error ? error.message : String(error)}`);
      const newEvent: CalendarEvent = {
        id: `cal-custom-${Date.now()}`,
        title,
        description,
        startTime,
        endTime,
        category,
        location,
      };
      this.mockEvents.push(newEvent);
      return newEvent;
    }
  }
}
