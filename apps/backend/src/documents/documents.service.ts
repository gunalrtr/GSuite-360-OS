import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleDriveService } from './google-drive.service';

export interface DocumentData {
  id?: string;
  name: string;
  category: string;
  fileUrl?: string;
  googleDriveId?: string;
  size?: number;
  mimeType?: string;
  createdAt?: Date;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  // In-memory fallback dataset
  private mockDocuments: DocumentData[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleDriveService: GoogleDriveService,
  ) {
    this.seedMockDocuments();
  }

  private seedMockDocuments() {
    this.mockDocuments = [
      {
        id: 'doc-1',
        name: 'Aadhaar_Card.pdf',
        category: 'ID Proof',
        fileUrl: '/uploads/Aadhaar_Card.pdf',
        googleDriveId: 'drive-file-1',
        size: 1048576,
        mimeType: 'application/pdf',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'doc-2',
        name: 'Rent_Agreement.pdf',
        category: 'Other',
        fileUrl: '/uploads/Rent_Agreement.pdf',
        googleDriveId: 'drive-file-3',
        size: 2097152,
        mimeType: 'application/pdf',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'doc-3',
        name: 'Resume_Gunal.pdf',
        category: 'Resume',
        fileUrl: '/uploads/Resume_Gunal.pdf',
        googleDriveId: 'drive-file-4',
        size: 153600,
        mimeType: 'application/pdf',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    ];
  }

  async getDocuments(userId: string): Promise<DocumentData[]> {
    try {
      const docs = await this.prisma.document.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (docs.length > 0) {
        return docs.map(d => ({
          id: d.id,
          name: d.name,
          category: d.category,
          fileUrl: d.fileUrl || undefined,
          googleDriveId: d.googleDriveId || undefined,
          size: d.size || undefined,
          mimeType: d.mimeType || undefined,
          createdAt: d.createdAt,
        }));
      }
    } catch (error) {
      this.logger.warn(`getDocuments: DB error, using memory fallback: ${error instanceof Error ? error.message : String(error)}`);
    }
    return [...this.mockDocuments].sort((a, b) => {
      const tB = b.createdAt ? b.createdAt.getTime() : 0;
      const tA = a.createdAt ? a.createdAt.getTime() : 0;
      return tB - tA;
    });
  }

  async createDocument(userId: string, data: Partial<DocumentData>): Promise<DocumentData> {
    const name = data.name || 'document.pdf';
    const category = data.category || 'Other';
    const size = data.size !== undefined ? data.size : 1024 * 100; // 100KB default
    const mimeType = data.mimeType || 'application/pdf';
    const fileUrl = data.fileUrl || `/uploads/${name}`;

    // Use existing googleDriveId if provided, otherwise upload to Google Drive (automatically)
    let googleDriveId = data.googleDriveId;
    if (!googleDriveId && !fileUrl.startsWith('http')) {
      try {
        const driveFile = await this.googleDriveService.uploadFile(name, mimeType);
        googleDriveId = driveFile.id;
      } catch (err) {
        this.logger.error('Google Drive sync failed on upload:', err);
      }
    }

    try {
      const doc = await this.prisma.document.create({
        data: {
          userId,
          name,
          category,
          fileUrl,
          size,
          mimeType,
          googleDriveId,
        },
      });
      return {
        id: doc.id,
        name: doc.name,
        category: doc.category,
        fileUrl: doc.fileUrl || undefined,
        googleDriveId: doc.googleDriveId || undefined,
        size: doc.size || undefined,
        mimeType: doc.mimeType || undefined,
        createdAt: doc.createdAt,
      };
    } catch (error) {
      this.logger.warn(`createDocument: DB error, adding to memory fallback: ${error instanceof Error ? error.message : String(error)}`);
      const newDoc: DocumentData = {
        id: `doc-custom-${Date.now()}`,
        name,
        category,
        fileUrl,
        googleDriveId,
        size,
        mimeType,
        createdAt: new Date(),
      };
      this.mockDocuments.push(newDoc);
      return newDoc;
    }
  }

  async syncToDrive(userId: string, docId: string): Promise<DocumentData> {
    let targetDoc: DocumentData | null = null;
    let isDb = true;

    try {
      const doc = await this.prisma.document.findFirst({
        where: { id: docId, userId },
      });
      if (doc) {
        targetDoc = {
          id: doc.id,
          name: doc.name,
          category: doc.category,
          fileUrl: doc.fileUrl || undefined,
          googleDriveId: doc.googleDriveId || undefined,
          size: doc.size || undefined,
          mimeType: doc.mimeType || undefined,
          createdAt: doc.createdAt,
        };
      }
    } catch (error) {
      isDb = false;
    }

    if (!targetDoc) {
      targetDoc = this.mockDocuments.find(d => d.id === docId) || null;
      isDb = false;
    }

    if (!targetDoc) {
      throw new Error('Document not found');
    }

    if (targetDoc.googleDriveId) {
      return targetDoc; // Already synced
    }

    // Trigger sync
    const driveFile = await this.googleDriveService.uploadFile(targetDoc.name, targetDoc.mimeType || 'application/pdf');
    targetDoc.googleDriveId = driveFile.id;

    if (isDb) {
      try {
        await this.prisma.document.update({
          where: { id: docId },
          data: { googleDriveId: driveFile.id },
        });
      } catch (err) {
        this.logger.warn(`Failed to update googleDriveId in DB: ${err}`);
      }
    }

    return targetDoc;
  }

  async deleteDocument(userId: string, docId: string): Promise<boolean> {
    let targetDoc: DocumentData | null = null;
    let isDb = true;

    try {
      const doc = await this.prisma.document.findFirst({
        where: { id: docId, userId },
      });
      if (doc) {
        targetDoc = {
          id: doc.id,
          name: doc.name,
          category: doc.category,
          googleDriveId: doc.googleDriveId || undefined,
        };
      }
    } catch (error) {
      isDb = false;
    }

    if (!targetDoc) {
      targetDoc = this.mockDocuments.find(d => d.id === docId) || null;
      isDb = false;
    }

    if (!targetDoc) {
      return false;
    }

    // Delete from Google Drive if synced
    if (targetDoc.googleDriveId) {
      try {
        await this.googleDriveService.deleteFile(targetDoc.googleDriveId);
      } catch (err) {
        this.logger.error('Failed to delete file from Google Drive:', err);
      }
    }

    // Delete locally
    if (isDb) {
      try {
        await this.prisma.document.delete({
          where: { id: docId },
        });
        return true;
      } catch (err) {
        this.logger.warn(`Failed to delete document from DB: ${err}`);
      }
    }

    this.mockDocuments = this.mockDocuments.filter(d => d.id !== docId);
    return true;
  }

  getGoogleDriveConnection(): boolean {
    return this.googleDriveService.isGoogleConnected();
  }
}
