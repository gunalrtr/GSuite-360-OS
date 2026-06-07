import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HolidaysService } from '../holidays/holidays.service';

export type ShiftType = 'MORNING' | 'AFTERNOON' | 'FULL_DAY';

export interface WorkSession {
  id: string;
  attendanceId: string;
  type: 'WORK' | 'BREAK';
  startTime: Date;
  endTime?: Date;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: Date;
  status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'HALF_DAY';
  shift: ShiftType;
  checkedInAt?: Date;
  checkedOutAt?: Date;
  totalHours: number;
  otHours: number;
  breakMinutes: number;
  salaryImpact: number; // 1.0 = full, 0.5 = morning/afternoon, 0.0 = leave
  sessions: WorkSession[];
}

// Shift configuration — OT kicks in after 8 hours for every shift
export const SHIFT_CONFIG: Record<ShiftType, { startHour: number; startMin: number; endHour: number; endMin: number; standardHours: number; salaryImpact: number; label: string }> = {
  MORNING:   { startHour: 6,  startMin: 0,  endHour: 14, endMin: 0,  standardHours: 8.0, salaryImpact: 0.5, label: 'Morning Shift (6AM–2PM)' },
  AFTERNOON: { startHour: 14, startMin: 0,  endHour: 22, endMin: 0,  standardHours: 8.0, salaryImpact: 0.5, label: 'Afternoon Shift (2PM–10PM)' },
  FULL_DAY:  { startHour: 9,  startMin: 0,  endHour: 18, endMin: 0,  standardHours: 8.0, salaryImpact: 1.0, label: 'Full Day (9AM–6PM)' },
};

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  // In-memory fallback DB
  private inMemoryAttendance: AttendanceRecord[] = [];
  private inMemorySessions: WorkSession[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly holidaysService: HolidaysService
  ) {
    this.seedInMemoryHistory();
  }

  private seedInMemoryHistory() {
    const userId = 'mock-user-uuid-1234-5678';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Compute attendance period start: 26th of the previous month
    // (if today >= 26, period started on the 26th of this month)
    let periodStartMonth = today.getMonth() - 1;
    let periodStartYear = today.getFullYear();
    if (today.getDate() >= 26) {
      periodStartMonth = today.getMonth();
      periodStartYear = today.getFullYear();
    }
    if (periodStartMonth < 0) { periodStartMonth = 11; periodStartYear -= 1; }
    const periodStart = new Date(periodStartYear, periodStartMonth, 26, 0, 0, 0, 0);

    // Walk from period start to yesterday, seeding each working day
    const cursor = new Date(periodStart);
    let idx = 0;
    while (cursor < today) {
      const logDate = new Date(cursor);
      cursor.setDate(cursor.getDate() + 1);

      // Skip Sundays only
      if (logDate.getDay() === 0) continue;
      idx++;

      // Randomize statuses (no WFH)
      let status: 'PRESENT' | 'LEAVE' | 'HALF_DAY' = 'PRESENT';
      const rand = Math.random();
      if (rand > 0.90) status = 'HALF_DAY';
      else if (rand > 0.85) status = 'LEAVE';

      // Random shift (80% FULL_DAY, 10% MORNING, 10% AFTERNOON)
      let shift: ShiftType = 'FULL_DAY';
      const shiftRand = Math.random();
      if (status === 'PRESENT') {
        if (shiftRand < 0.10) shift = 'MORNING';
        else if (shiftRand < 0.20) shift = 'AFTERNOON';
        else shift = 'FULL_DAY';
      }

      const shiftCfg = SHIFT_CONFIG[shift];
      const attId = `att-history-${idx}`;

      if (status === 'LEAVE') {
        this.inMemoryAttendance.push({
          id: attId,
          userId,
          date: logDate,
          status: 'LEAVE',
          shift: 'FULL_DAY',
          totalHours: 0.0,
          otHours: 0.0,
          breakMinutes: 0.0,
          salaryImpact: 0.0,
          sessions: [],
        });
      } else {
        const checkedInAt = new Date(logDate);
        checkedInAt.setHours(shiftCfg.startHour, Math.floor(Math.random() * 15), 0, 0);

        const checkedOutAt = new Date(logDate);
        // Allow slight OT on full-day
        const otExtraMin = shift === 'FULL_DAY' ? Math.floor(Math.random() * 120) : 0;
        checkedOutAt.setHours(shiftCfg.endHour, shiftCfg.endMin + otExtraMin, 0, 0);

        const totalMs = checkedOutAt.getTime() - checkedInAt.getTime();
        const breakMin = shift === 'FULL_DAY' ? Math.floor(Math.random() * 30) + 45 : 15;
        const totalHours = Math.max(0, parseFloat(((totalMs / (1000 * 60 * 60)) - (breakMin / 60)).toFixed(2)));
        const otHours = Math.max(0, parseFloat((totalHours - shiftCfg.standardHours).toFixed(2)));
        const salaryImpact = status === 'HALF_DAY' ? 0.5 : shiftCfg.salaryImpact;

        const record: AttendanceRecord = {
          id: attId,
          userId,
          date: logDate,
          status,
          shift,
          checkedInAt,
          checkedOutAt,
          totalHours,
          otHours,
          breakMinutes: breakMin,
          salaryImpact,
          sessions: [
            {
              id: `sess-work-1-${idx}`,
              attendanceId: attId,
              type: 'WORK',
              startTime: checkedInAt,
              endTime: new Date(checkedInAt.getTime() + (shiftCfg.standardHours / 2) * 60 * 60 * 1000),
            },
            {
              id: `sess-break-${idx}`,
              attendanceId: attId,
              type: 'BREAK',
              startTime: new Date(checkedInAt.getTime() + (shiftCfg.standardHours / 2) * 60 * 60 * 1000),
              endTime: new Date(checkedInAt.getTime() + (shiftCfg.standardHours / 2) * 60 * 60 * 1000 + breakMin * 60 * 1000),
            },
            {
              id: `sess-work-2-${idx}`,
              attendanceId: attId,
              type: 'WORK',
              startTime: new Date(checkedInAt.getTime() + (shiftCfg.standardHours / 2) * 60 * 60 * 1000 + breakMin * 60 * 1000),
              endTime: checkedOutAt,
            }
          ],
        };
        this.inMemoryAttendance.push(record);
        this.inMemorySessions.push(...record.sessions);
      }
    }
  }

  async getTodayStatus(userId: string): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const record = await this.prisma.attendance.findUnique({
        where: {
          userId_date: { userId, date: today },
        },
        include: {
          sessions: true,
        },
      });

      if (!record) {
        return { checkedIn: false, record: null, activeSession: null };
      }

      const activeSession = record.sessions.find(s => s.endTime === null) || null;
      return {
        checkedIn: !!record.checkedInAt,
        record,
        activeSession,
      };
    } catch (error) {
      this.logger.warn(`getTodayStatus database lookup failed, using memory. Error: ${error instanceof Error ? error.message : String(error)}`);

      const record = this.inMemoryAttendance.find(
        r => r.userId === userId && r.date.getTime() === today.getTime()
      );

      if (!record) {
        return { checkedIn: false, record: null, activeSession: null };
      }

      const activeSession = record.sessions.find(s => !s.endTime) || null;
      return {
        checkedIn: !!record.checkedInAt,
        record,
        activeSession,
      };
    }
  }

  async checkIn(userId: string, shift: ShiftType = 'FULL_DAY'): Promise<any> {
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);

    const shiftCfg = SHIFT_CONFIG[shift];
    const salaryImpact = shiftCfg.salaryImpact;

    try {
      const existing = await this.prisma.attendance.findUnique({
        where: { userId_date: { userId, date: todayStart } },
      });

      if (existing && existing.checkedInAt) {
        throw new BadRequestException('Already checked in today');
      }

      const record = await this.prisma.$transaction(async (tx) => {
        const att = await tx.attendance.upsert({
          where: { userId_date: { userId, date: todayStart } },
          update: {
            status: 'PRESENT',
            shift: shift as any,
            checkedInAt: today,
            salaryImpact,
          },
          create: {
            userId,
            date: todayStart,
            status: 'PRESENT',
            shift: shift as any,
            checkedInAt: today,
            salaryImpact,
          },
        });

        const session = await tx.workSession.create({
          data: {
            attendanceId: att.id,
            type: 'WORK',
            startTime: today,
          },
        });

        return { ...att, sessions: [session] };
      });

      return { record, activeSession: record.sessions[0] };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      this.logger.warn(`checkIn database execution failed, using memory. Error: ${error instanceof Error ? error.message : String(error)}`);

      let record = this.inMemoryAttendance.find(
        r => r.userId === userId && r.date.getTime() === todayStart.getTime()
      );

      if (record && record.checkedInAt) {
        throw new BadRequestException('Already checked in today');
      }

      const attId = `att-session-${Date.now()}`;
      const session: WorkSession = {
        id: `sess-${Date.now()}`,
        attendanceId: attId,
        type: 'WORK',
        startTime: today,
      };

      record = {
        id: attId,
        userId,
        date: todayStart,
        status: 'PRESENT',
        shift,
        checkedInAt: today,
        totalHours: 0,
        otHours: 0,
        breakMinutes: 0,
        salaryImpact,
        sessions: [session],
      };

      this.inMemoryAttendance.push(record);
      this.inMemorySessions.push(session);

      return { record, activeSession: session };
    }
  }

  async startBreak(userId: string): Promise<any> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    try {
      const record = await this.prisma.attendance.findUnique({
        where: { userId_date: { userId, date: todayStart } },
        include: { sessions: true },
      });

      if (!record || !record.checkedInAt) {
        throw new BadRequestException('Not checked in today');
      }

      const activeSession = record.sessions.find(s => s.endTime === null);
      if (!activeSession) {
        throw new BadRequestException('No active work session');
      }

      if (activeSession.type === 'BREAK') {
        throw new BadRequestException('Already on a break');
      }

      const now = new Date();
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.workSession.update({
          where: { id: activeSession.id },
          data: { endTime: now },
        });

        const newSession = await tx.workSession.create({
          data: {
            attendanceId: record.id,
            type: 'BREAK',
            startTime: now,
          },
        });

        return newSession;
      });

      return { activeSession: updated };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      this.logger.warn(`startBreak database execution failed, using memory. Error: ${error instanceof Error ? error.message : String(error)}`);

      const record = this.inMemoryAttendance.find(
        r => r.userId === userId && r.date.getTime() === todayStart.getTime()
      );

      if (!record || !record.checkedInAt) {
        throw new BadRequestException('Not checked in today');
      }

      const activeSession = record.sessions.find(s => !s.endTime);
      if (!activeSession) {
        throw new BadRequestException('No active work session');
      }

      if (activeSession.type === 'BREAK') {
        throw new BadRequestException('Already on a break');
      }

      const now = new Date();
      activeSession.endTime = now;

      const newSession: WorkSession = {
        id: `sess-break-${Date.now()}`,
        attendanceId: record.id,
        type: 'BREAK',
        startTime: now,
      };

      record.sessions.push(newSession);
      this.inMemorySessions.push(newSession);

      return { activeSession: newSession };
    }
  }

  async endBreak(userId: string): Promise<any> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    try {
      const record = await this.prisma.attendance.findUnique({
        where: { userId_date: { userId, date: todayStart } },
        include: { sessions: true },
      });

      if (!record || !record.checkedInAt) {
        throw new BadRequestException('Not checked in today');
      }

      const activeSession = record.sessions.find(s => s.endTime === null);
      if (!activeSession || activeSession.type !== 'BREAK') {
        throw new BadRequestException('Not currently on a break');
      }

      const now = new Date();
      const breakDurationMinutes = Math.floor((now.getTime() - activeSession.startTime.getTime()) / (1000 * 60));

      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.workSession.update({
          where: { id: activeSession.id },
          data: { endTime: now },
        });

        const newSession = await tx.workSession.create({
          data: {
            attendanceId: record.id,
            type: 'WORK',
            startTime: now,
          },
        });

        await tx.attendance.update({
          where: { id: record.id },
          data: {
            breakMinutes: {
              increment: breakDurationMinutes,
            },
          },
        });

        return newSession;
      });

      return { activeSession: updated };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      this.logger.warn(`endBreak database execution failed, using memory. Error: ${error instanceof Error ? error.message : String(error)}`);

      const record = this.inMemoryAttendance.find(
        r => r.userId === userId && r.date.getTime() === todayStart.getTime()
      );

      if (!record || !record.checkedInAt) {
        throw new BadRequestException('Not checked in today');
      }

      const activeSession = record.sessions.find(s => !s.endTime);
      if (!activeSession || activeSession.type !== 'BREAK') {
        throw new BadRequestException('Not currently on a break');
      }

      const now = new Date();
      activeSession.endTime = now;
      const breakDurationMinutes = Math.floor((now.getTime() - activeSession.startTime.getTime()) / (1000 * 60));

      record.breakMinutes += breakDurationMinutes;

      const newSession: WorkSession = {
        id: `sess-work-${Date.now()}`,
        attendanceId: record.id,
        type: 'WORK',
        startTime: now,
      };

      record.sessions.push(newSession);
      this.inMemorySessions.push(newSession);

      return { activeSession: newSession };
    }
  }

  async checkOut(userId: string): Promise<any> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    try {
      const record = await this.prisma.attendance.findUnique({
        where: { userId_date: { userId, date: todayStart } },
        include: { sessions: true },
      });

      if (!record || !record.checkedInAt) {
        throw new BadRequestException('Not checked in today');
      }

      if (record.checkedOutAt) {
        throw new BadRequestException('Already checked out today');
      }

      const activeSession = record.sessions.find(s => s.endTime === null);
      const now = new Date();

      const updated = await this.prisma.$transaction(async (tx) => {
        if (activeSession) {
          await tx.workSession.update({
            where: { id: activeSession.id },
            data: { endTime: now },
          });
        }

        // Re-read sessions to calculate total elapsed work time
        const allSessions = await tx.workSession.findMany({
          where: { attendanceId: record.id },
        });

        const sessionsWithEnd = allSessions.map(s =>
          s.id === activeSession?.id ? { ...s, endTime: now } : s
        );

        let workTimeMs = 0;
        let breakTimeMs = 0;

        sessionsWithEnd.forEach(s => {
          const end = s.endTime || now;
          const duration = end.getTime() - s.startTime.getTime();
          if (s.type === 'WORK') {
            workTimeMs += duration;
          } else {
            breakTimeMs += duration;
          }
        });

        const totalHours = parseFloat((workTimeMs / (1000 * 60 * 60)).toFixed(2));
        const isHoliday = !!this.holidaysService.isHoliday(new Date(record.date));

        // OT is relative to shift standard hours
        const shiftCfg = SHIFT_CONFIG[record.shift as ShiftType] || SHIFT_CONFIG.FULL_DAY;
        const standardHours = shiftCfg.standardHours;
        const otHours = isHoliday ? totalHours : Math.max(0.0, parseFloat((totalHours - standardHours).toFixed(2)));
        const breakMinutes = Math.floor(breakTimeMs / (1000 * 60));

        const updatedAtt = await tx.attendance.update({
          where: { id: record.id },
          data: {
            checkedOutAt: now,
            totalHours,
            otHours,
            breakMinutes,
          },
          include: { sessions: true },
        });

        return updatedAtt;
      });

      return { record: updated };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      this.logger.warn(`checkOut database execution failed, using memory. Error: ${error instanceof Error ? error.message : String(error)}`);

      const record = this.inMemoryAttendance.find(
        r => r.userId === userId && r.date.getTime() === todayStart.getTime()
      );

      if (!record || !record.checkedInAt) {
        throw new BadRequestException('Not checked in today');
      }

      if (record.checkedOutAt) {
        throw new BadRequestException('Already checked out today');
      }

      const activeSession = record.sessions.find(s => !s.endTime);
      const now = new Date();

      if (activeSession) {
        activeSession.endTime = now;
      }

      let workTimeMs = 0;
      let breakTimeMs = 0;

      record.sessions.forEach(s => {
        const end = s.endTime || now;
        const duration = end.getTime() - s.startTime.getTime();
        if (s.type === 'WORK') {
          workTimeMs += duration;
        } else {
          breakTimeMs += duration;
        }
      });

      const totalHours = parseFloat((workTimeMs / (1000 * 60 * 60)).toFixed(2));
      const isHoliday = !!this.holidaysService.isHoliday(new Date(record.date));

      const shiftCfg = SHIFT_CONFIG[record.shift] || SHIFT_CONFIG.FULL_DAY;
      const otHours = isHoliday ? totalHours : Math.max(0.0, parseFloat((totalHours - shiftCfg.standardHours).toFixed(2)));
      const breakMinutes = Math.floor(breakTimeMs / (1000 * 60));

      record.checkedOutAt = now;
      record.totalHours = totalHours;
      record.otHours = otHours;
      record.breakMinutes = breakMinutes;

      return { record };
    }
  }

  async applyLeave(userId: string, dateStr: string, status: 'LEAVE' | 'HALF_DAY'): Promise<any> {
    const leaveDate = new Date(dateStr);
    leaveDate.setHours(0, 0, 0, 0);

    const salaryImpact = status === 'HALF_DAY' ? 0.5 : 0.0;

    try {
      const record = await this.prisma.attendance.upsert({
        where: {
          userId_date: { userId, date: leaveDate },
        },
        update: {
          status,
          salaryImpact,
          checkedInAt: null,
          checkedOutAt: null,
          totalHours: 0.0,
          otHours: 0.0,
        },
        create: {
          userId,
          date: leaveDate,
          status,
          shift: 'FULL_DAY',
          salaryImpact,
          totalHours: 0.0,
          otHours: 0.0,
        },
      });

      return { record };
    } catch (error) {
      this.logger.warn(`applyLeave database execution failed, using memory. Error: ${error instanceof Error ? error.message : String(error)}`);

      let record = this.inMemoryAttendance.find(
        r => r.userId === userId && r.date.getTime() === leaveDate.getTime()
      );

      if (record) {
        record.status = status;
        record.salaryImpact = salaryImpact;
        record.checkedInAt = undefined;
        record.checkedOutAt = undefined;
        record.totalHours = 0.0;
        record.otHours = 0.0;
        record.sessions = [];
      } else {
        record = {
          id: `att-leave-${Date.now()}`,
          userId,
          date: leaveDate,
          status,
          shift: 'FULL_DAY',
          totalHours: 0.0,
          otHours: 0.0,
          breakMinutes: 0.0,
          salaryImpact,
          sessions: [],
        };
        this.inMemoryAttendance.push(record);
      }

      return { record };
    }
  }

  async getHistory(userId: string, limit = 30): Promise<any[]> {
    try {
      const records = await this.prisma.attendance.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: limit,
        include: { sessions: true },
      });
      return records;
    } catch (error) {
      this.logger.warn(`getHistory database query failed, using memory. Error: ${error instanceof Error ? error.message : String(error)}`);

      return [...this.inMemoryAttendance]
        .filter(r => r.userId === userId)
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, limit);
    }
  }

  async manualEntry(
    userId: string,
    date: string,
    shift: ShiftType,
    checkedInAt: string,
    checkedOutAt: string,
    status: 'PRESENT' | 'HALF_DAY' | 'LEAVE',
  ): Promise<any> {
    const entryDate = new Date(date);
    entryDate.setHours(0, 0, 0, 0);

    const checkIn = new Date(checkedInAt);
    const checkOut = new Date(checkedOutAt);

    const shiftCfg = SHIFT_CONFIG[shift];
    const breakMin = shift === 'FULL_DAY' ? 45 : 15;
    const totalMs = status === 'LEAVE' ? 0 : Math.max(0, checkOut.getTime() - checkIn.getTime());
    const totalHours = status === 'LEAVE' ? 0 : Math.max(0, parseFloat(((totalMs / (1000 * 60 * 60)) - (breakMin / 60)).toFixed(2)));
    const otHours = status === 'LEAVE' ? 0 : Math.max(0, parseFloat((totalHours - shiftCfg.standardHours).toFixed(2)));
    const salaryImpact = status === 'LEAVE' ? 0 : status === 'HALF_DAY' ? 0.5 : shiftCfg.salaryImpact;

    try {
      const record = await this.prisma.attendance.upsert({
        where: { userId_date: { userId, date: entryDate } },
        update: {
          status,
          shift: shift as any,
          checkedInAt: status === 'LEAVE' ? null : checkIn,
          checkedOutAt: status === 'LEAVE' ? null : checkOut,
          totalHours,
          otHours,
          breakMinutes: breakMin,
          salaryImpact,
        },
        create: {
          userId,
          date: entryDate,
          status,
          shift: shift as any,
          checkedInAt: status === 'LEAVE' ? null : checkIn,
          checkedOutAt: status === 'LEAVE' ? null : checkOut,
          totalHours,
          otHours,
          breakMinutes: breakMin,
          salaryImpact,
        },
      });
      return { record, manual: true };
    } catch (error) {
      this.logger.warn(`manualEntry: DB offline, saving to memory. Error: ${error instanceof Error ? error.message : String(error)}`);

      // Remove existing entry for that date if any
      const existingIdx = this.inMemoryAttendance.findIndex(
        r => r.userId === userId && r.date.toDateString() === entryDate.toDateString()
      );
      if (existingIdx !== -1) this.inMemoryAttendance.splice(existingIdx, 1);

      const attId = `att-manual-${Date.now()}`;
      const newRecord: AttendanceRecord = {
        id: attId,
        userId,
        date: entryDate,
        status,
        shift,
        checkedInAt: status === 'LEAVE' ? undefined : checkIn,
        checkedOutAt: status === 'LEAVE' ? undefined : checkOut,
        totalHours,
        otHours,
        breakMinutes: breakMin,
        salaryImpact,
        sessions: [],
      };
      this.inMemoryAttendance.push(newRecord);
      return { record: newRecord, manual: true };
    }
  }
}
