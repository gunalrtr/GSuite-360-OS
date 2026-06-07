import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { GoogleDriveService } from './google-drive.service';

@Module({
  imports: [PrismaModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, GoogleDriveService],
  exports: [DocumentsService, GoogleDriveService],
})
export class DocumentsModule {}
