import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AttendanceModule } from './attendance/attendance.module';
import { SalaryModule } from './salary/salary.module';
import { DiaryModule } from './diary/diary.module';
import { TasksModule } from './tasks/tasks.module';
import { ParserModule } from './parser/parser.module';
import { HolidaysModule } from './holidays/holidays.module';
import { CalendarModule } from './calendar/calendar.module';
import { TelegramModule } from './telegram/telegram.module';
import { FinanceModule } from './finance/finance.module';
import { LifeModule } from './life/life.module';
import { DocumentsModule } from './documents/documents.module';
import { StoreModule } from './store/store.module';
import { AiModule } from './ai/ai.module';
import { ReportsModule } from './reports/reports.module';
import { SchedulerService } from './tasks/scheduler.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    AttendanceModule,
    SalaryModule,
    DiaryModule,
    TasksModule,
    ParserModule,
    HolidaysModule,
    CalendarModule,
    TelegramModule,
    FinanceModule,
    LifeModule,
    DocumentsModule,
    StoreModule,
    AiModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService, SchedulerService],
})
export class AppModule {}




