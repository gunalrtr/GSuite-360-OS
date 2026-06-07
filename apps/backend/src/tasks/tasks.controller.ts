import { Controller, Get, Post, Patch, Delete, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  async getTasks(@Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.tasksService.getTasks(userId);
  }

  @Post()
  async createTask(
    @Body() body: { userId: string; title: string; description?: string; priority?: 'HIGH' | 'MEDIUM' | 'LOW'; status?: 'TODO' | 'IN_PROGRESS' | 'COMPLETED'; dueDate?: string; tags?: string[] }
  ) {
    if (!body.userId || !body.title) {
      throw new BadRequestException('userId and title are required');
    }
    const { dueDate, ...rest } = body;
    return this.tasksService.createTask(body.userId, {
      ...rest,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });
  }

  @Patch(':id')
  async updateTask(
    @Param('id') id: string,
    @Body() body: { userId: string; title?: string; description?: string; priority?: 'HIGH' | 'MEDIUM' | 'LOW'; status?: 'TODO' | 'IN_PROGRESS' | 'COMPLETED'; dueDate?: string; tags?: string[]; carryForwardCount?: number }
  ) {
    if (!body.userId) {
      throw new BadRequestException('userId is required');
    }
    const { dueDate, ...rest } = body;
    return this.tasksService.updateTask(body.userId, id, {
      ...rest,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });
  }

  @Delete(':id')
  async deleteTask(
    @Param('id') id: string,
    @Query('userId') userId: string
  ) {
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }
    return this.tasksService.deleteTask(userId, id);
  }

  @Post('carry-forward')
  async triggerCarryForward(@Body() body: { userId: string }) {
    if (!body.userId) {
      throw new BadRequestException('userId is required');
    }
    return this.tasksService.carryForwardTasks(body.userId);
  }
}
