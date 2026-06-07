import { Module, forwardRef } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { ParserModule } from '../parser/parser.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { TasksModule } from '../tasks/tasks.module';
import { DiaryModule } from '../diary/diary.module';
import { CalendarModule } from '../calendar/calendar.module';
import { FinanceModule } from '../finance/finance.module';
import { LifeModule } from '../life/life.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    ParserModule,
    forwardRef(() => AttendanceModule),
    forwardRef(() => TasksModule),
    forwardRef(() => DiaryModule),
    CalendarModule,
    FinanceModule,
    LifeModule,
    AiModule,
  ],
  providers: [TelegramService],
  controllers: [TelegramController],
  exports: [TelegramService],
})
export class TelegramModule {}
