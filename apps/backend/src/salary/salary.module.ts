import { Module, forwardRef } from '@nestjs/common';
import { SalaryService } from './salary.service';
import { SalaryController } from './salary.controller';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [forwardRef(() => AttendanceModule)],
  providers: [SalaryService],
  controllers: [SalaryController],
  exports: [SalaryService],
})
export class SalaryModule {}
