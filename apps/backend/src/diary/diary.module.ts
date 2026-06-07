import { Module } from '@nestjs/common';
import { DiaryService } from './diary.service';
import { DiaryController } from './diary.controller';

@Module({
  providers: [DiaryService],
  controllers: [DiaryController],
  exports: [DiaryService],
})
export class DiaryModule {}
