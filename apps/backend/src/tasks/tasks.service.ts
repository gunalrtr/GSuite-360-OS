import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DiaryService } from '../diary/diary.service';

export interface TaskRecord {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
  dueDate?: Date;
  tags: string[];
  carryForwardCount: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  // In-memory fallback
  private inMemoryTasks: TaskRecord[] = [];

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DiaryService))
    private readonly diaryService: DiaryService
  ) {
    this.seedMockTasks();
  }

  private seedMockTasks() {
    const userId = 'mock-user-uuid-1234-5678';
    const today = new Date();

    this.inMemoryTasks.push(
      {
        id: 'task-mock-1',
        userId,
        title: 'Verify pending PO from local distributors',
        description: 'Verify supplier code and match against GRN checklist.',
        priority: 'HIGH',
        status: 'TODO',
        dueDate: new Date(today.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
        tags: ['PO', 'Verification'],
        carryForwardCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-mock-2',
        userId,
        title: 'Stock verification at main store aisle B',
        description: 'Audit bin capacity and count discrepancy entries.',
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
        dueDate: today,
        tags: ['Aisle B', 'Audit'],
        carryForwardCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-mock-3',
        userId,
        title: 'Generate monthly store KPI dashboard report',
        description: 'Tally GRN count and PO processing speeds.',
        priority: 'LOW',
        status: 'COMPLETED',
        dueDate: new Date(today.getTime() - 24 * 60 * 60 * 1000), // Yesterday
        tags: ['KPI', 'Reports'],
        carryForwardCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    );
  }

  async getTasks(userId: string): Promise<TaskRecord[]> {
    try {
      const tasks = await this.prisma.task.findMany({
        where: { userId },
        orderBy: [
          { status: 'asc' }, // TODO first
          { priority: 'asc' }, // Order priority
          { createdAt: 'desc' },
        ],
      });
      // Cast enum values
      return tasks.map(t => ({
        ...t,
        description: t.description || undefined,
        dueDate: t.dueDate || undefined,
        priority: t.priority as any,
        status: t.status as any,
      }));
    } catch (error) {
      this.logger.warn(`getTasks: Database query failed, using memory. Error: ${error instanceof Error ? error.message : String(error)}`);
      return [...this.inMemoryTasks]
        .filter(t => t.userId === userId)
        .sort((a, b) => {
          if (a.status === 'COMPLETED' && b.status !== 'COMPLETED') return 1;
          if (a.status !== 'COMPLETED' && b.status === 'COMPLETED') return -1;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
    }
  }

  async createTask(userId: string, data: Partial<TaskRecord>): Promise<TaskRecord> {
    const title = data.title || 'New Task';
    const description = data.description || '';
    const priority = data.priority || 'MEDIUM';
    const status = data.status || 'TODO';
    const dueDate = data.dueDate ? new Date(data.dueDate) : null;
    const tags = data.tags || [];

    try {
      const task = await this.prisma.task.create({
        data: {
          userId,
          title,
          description,
          priority,
          status,
          dueDate,
          tags,
          carryForwardCount: 0,
        },
      });
      return {
        ...task,
        description: task.description || undefined,
        dueDate: task.dueDate || undefined,
        priority: task.priority as any,
        status: task.status as any,
      };
    } catch (error) {
      this.logger.warn(`createTask: Database write failed, saving in memory. Error: ${error instanceof Error ? error.message : String(error)}`);
      const newTask: TaskRecord = {
        id: `task-${Date.now()}`,
        userId,
        title,
        description,
        priority,
        status,
        dueDate: dueDate || undefined,
        tags,
        carryForwardCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.inMemoryTasks.push(newTask);
      return newTask;
    }
  }

  async updateTask(userId: string, taskId: string, data: Partial<TaskRecord>): Promise<TaskRecord> {
    try {
      const updateData: any = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
      if (data.tags !== undefined) updateData.tags = data.tags;
      if (data.carryForwardCount !== undefined) updateData.carryForwardCount = data.carryForwardCount;

      const task = await this.prisma.task.update({
        where: { id: taskId },
        data: updateData,
      });

      return {
        ...task,
        description: task.description || undefined,
        dueDate: task.dueDate || undefined,
        priority: task.priority as any,
        status: task.status as any,
      };
    } catch (error) {
      this.logger.warn(`updateTask: Database update failed, updating memory. Error: ${error instanceof Error ? error.message : String(error)}`);
      
      const task = this.inMemoryTasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      if (data.title !== undefined) task.title = data.title;
      if (data.description !== undefined) task.description = data.description;
      if (data.priority !== undefined) task.priority = data.priority;
      if (data.status !== undefined) task.status = data.status;
      if (data.dueDate !== undefined) task.dueDate = data.dueDate ? new Date(data.dueDate) : undefined;
      if (data.tags !== undefined) task.tags = data.tags;
      if (data.carryForwardCount !== undefined) task.carryForwardCount = data.carryForwardCount;
      task.updatedAt = new Date();

      return task;
    }
  }

  async deleteTask(userId: string, taskId: string): Promise<any> {
    try {
      await this.prisma.task.delete({
        where: { id: taskId },
      });
      return { success: true };
    } catch (error) {
      this.logger.warn(`deleteTask: Database delete failed, removing from memory. Error: ${error instanceof Error ? error.message : String(error)}`);
      const index = this.inMemoryTasks.findIndex(t => t.id === taskId);
      if (index > -1) {
        this.inMemoryTasks.splice(index, 1);
      }
      return { success: true };
    }
  }

  // Auto Carry Forward Engine
  async carryForwardTasks(userId: string): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    let parsedTasksCount = 0;
    let carriedTasksCount = 0;

    try {
      // 1. Fetch yesterday's tomorrowPlan from Diary
      const diary = await this.diaryService.getDiaryByDate(userId, yesterday.toISOString());
      if (diary && diary.tomorrowPlan) {
        // Parse line by line to extract bullet points
        const lines = diary.tomorrowPlan.split('\n');
        for (const line of lines) {
          const cleanLine = line.replace(/^[-*•\s]+/, '').trim();
          if (cleanLine.length > 0) {
            // Check if task already exists with this clean title to avoid duplication
            const existing = await this.prisma.task.findFirst({
              where: { userId, title: cleanLine, status: 'TODO' },
            });

            if (!existing) {
              await this.createTask(userId, {
                title: cleanLine,
                priority: 'MEDIUM',
                status: 'TODO',
                dueDate: today,
                tags: ['Carried Forward', 'Diary Plan'],
              });
              parsedTasksCount++;
            }
          }
        }
      }

      // 2. Increment carryForwardCount for any uncompleted tasks from yesterday (or older)
      const uncompletedTasks = await this.prisma.task.findMany({
        where: {
          userId,
          status: { in: ['TODO', 'IN_PROGRESS'] },
          createdAt: { lt: today },
        },
      });

      for (const t of uncompletedTasks) {
        await this.prisma.task.update({
          where: { id: t.id },
          data: {
            carryForwardCount: { increment: 1 },
          },
        });
        carriedTasksCount++;
      }
    } catch (error) {
      this.logger.warn(`carryForwardTasks database run failed, using in-memory execution. Error: ${error instanceof Error ? error.message : String(error)}`);
      
      // In-Memory Execution
      const diary = await this.diaryService.getDiaryByDate(userId, yesterday.toISOString());
      if (diary && diary.tomorrowPlan) {
        const lines = diary.tomorrowPlan.split('\n');
        for (const line of lines) {
          const cleanLine = line.replace(/^[-*•\s]+/, '').trim();
          if (cleanLine.length > 0) {
            const existing = this.inMemoryTasks.find(
              t => t.userId === userId && t.title === cleanLine && t.status === 'TODO'
            );
            if (!existing) {
              this.inMemoryTasks.push({
                id: `task-cf-${Date.now()}-${Math.floor(Math.random()*100)}`,
                userId,
                title: cleanLine,
                priority: 'MEDIUM',
                status: 'TODO',
                dueDate: today,
                tags: ['Carried Forward', 'Diary Plan'],
                carryForwardCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
              parsedTasksCount++;
            }
          }
        }
      }

      // Increment in-memory counters
      this.inMemoryTasks.forEach(t => {
        if (t.userId === userId && t.status !== 'COMPLETED' && t.createdAt.getTime() < today.getTime()) {
          t.carryForwardCount++;
          carriedTasksCount++;
        }
      });
    }

    return {
      success: true,
      diaryTasksCreated: parsedTasksCount,
      oldTasksCarriedForward: carriedTasksCount,
    };
  }
}
