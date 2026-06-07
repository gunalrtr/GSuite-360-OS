import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { TasksModule } from '../tasks/tasks.module';
import { DiaryModule } from '../diary/diary.module';
import { FinanceModule } from '../finance/finance.module';
import { SalaryModule } from '../salary/salary.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AttendanceModule),
    forwardRef(() => TasksModule),
    forwardRef(() => DiaryModule),
    FinanceModule,
    forwardRef(() => SalaryModule),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
