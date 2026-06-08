import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async getDocuments(@Query('userId') userId: string) {
    const activeUserId = userId || 'mock-user-uuid';
    const docs = await this.documentsService.getDocuments(activeUserId);
    return { success: true, documents: docs };
  }

  @Post()
  async createDocument(
    @Body('userId') userId: string,
    @Body('name') name: string,
    @Body('category') category: string,
    @Body('size') size: number,
    @Body('mimeType') mimeType: string,
    @Body('fileUrl') fileUrl?: string,
    @Body('googleDriveId') googleDriveId?: string,
  ) {
    const activeUserId = userId || 'mock-user-uuid';
    const doc = await this.documentsService.createDocument(activeUserId, {
      name,
      category,
      size,
      mimeType,
      fileUrl,
      googleDriveId,
    });
    return { success: true, document: doc };
  }

  @Post(':id/sync')
  async syncToDrive(@Param('id') docId: string, @Body('userId') userId: string) {
    const activeUserId = userId || 'mock-user-uuid';
    const doc = await this.documentsService.syncToDrive(activeUserId, docId);
    return { success: true, document: doc };
  }

  @Delete(':id')
  async deleteDocument(@Param('id') docId: string, @Query('userId') userId: string) {
    const activeUserId = userId || 'mock-user-uuid';
    const result = await this.documentsService.deleteDocument(activeUserId, docId);
    return { success: result };
  }

  @Get('status')
  getGoogleStatus() {
    const connected = this.documentsService.getGoogleDriveConnection();
    return { success: true, connected };
  }
}
