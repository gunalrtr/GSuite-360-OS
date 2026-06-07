import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { TasksModule } from '../tasks/tasks.module';
import { DiaryModule } from '../diary/diary.module';
import { FinanceModule } from '../finance/finance.module';
import { SalaryModule } from '../salary/salary.module';
import { CalendarModule } from '../calendar/calendar.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AttendanceModule),
    forwardRef(() => TasksModule),
    forwardRef(() => DiaryModule),
    FinanceModule,
    forwardRef(() => SalaryModule),
    CalendarModule,
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
