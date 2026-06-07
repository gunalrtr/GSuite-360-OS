import { Injectable, Logger } from '@nestjs/common';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  webViewLink?: string;
}

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);
  private driveClient: any = null;
  private isMock = true;

  // Initial mock files in Google Drive
  private mockDriveFiles: DriveFile[] = [
    { id: 'drive-file-1', name: 'Aadhaar_Card.pdf', mimeType: 'application/pdf', size: 1048576, webViewLink: '#' },
    { id: 'drive-file-2', name: 'Form_16_FY25.pdf', mimeType: 'application/pdf', size: 524288, webViewLink: '#' },
    { id: 'drive-file-3', name: 'Rent_Agreement.pdf', mimeType: 'application/pdf', size: 2097152, webViewLink: '#' },
    { id: 'drive-file-4', name: 'Resume_Gunal.pdf', mimeType: 'application/pdf', size: 153600, webViewLink: '#' },
  ];

  constructor() {
    this.initializeDrive();
  }

  private initializeDrive() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || clientId === 'mock-google-client-id') {
      this.logger.warn('Google Drive credentials not configured. Running in Mock Mode.');
      this.isMock = true;
      return;
    }

    try {
      // Lazy load googleapis to be safe if package isn't fully installed/linked
      const { google } = require('googleapis');
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'postmessage');
      this.driveClient = google.drive({ version: 'v3', auth: oauth2Client });
      this.isMock = false;
      this.logger.log('Google Drive API Client initialized successfully.');
    } catch (error) {
      this.logger.warn(`Failed to initialize Google Drive Client, falling back to Mock: ${error instanceof Error ? error.message : String(error)}`);
      this.isMock = true;
    }
  }

  isGoogleConnected(): boolean {
    return !this.isMock;
  }

  async listFiles(): Promise<DriveFile[]> {
    if (this.isMock) {
      return this.mockDriveFiles;
    }
    try {
      const response = await this.driveClient.files.list({
        pageSize: 30,
        fields: 'files(id, name, mimeType, size, webViewLink)',
      });
      return response.data.files || [];
    } catch (error) {
      this.logger.error(`Error listing Google Drive files, returning mock: ${error instanceof Error ? error.message : String(error)}`);
      return this.mockDriveFiles;
    }
  }

  async uploadFile(name: string, mimeType: string, contentStream?: any): Promise<DriveFile> {
    if (this.isMock) {
      const newFile: DriveFile = {
        id: `drive-${Date.now()}`,
        name,
        mimeType,
        size: 256000, // mock 250KB
        webViewLink: '#',
      };
      this.mockDriveFiles.push(newFile);
      this.logger.log(`Uploaded to Google Drive (Mock Mode): ${name}`);
      return newFile;
    }

    try {
      const response = await this.driveClient.files.create({
        requestBody: {
          name: name,
          mimeType: mimeType,
        },
        media: {
          mimeType: mimeType,
          body: contentStream,
        },
        fields: 'id, name, mimeType, size, webViewLink',
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Error uploading to Google Drive, using mock: ${error instanceof Error ? error.message : String(error)}`);
      const newFile: DriveFile = {
        id: `drive-${Date.now()}`,
        name,
        mimeType,
        size: 256000,
        webViewLink: '#',
      };
      this.mockDriveFiles.push(newFile);
      return newFile;
    }
  }

  async deleteFile(fileId: string): Promise<boolean> {
    if (this.isMock) {
      this.mockDriveFiles = this.mockDriveFiles.filter((f) => f.id !== fileId);
      this.logger.log(`Deleted file in Google Drive (Mock Mode): ${fileId}`);
      return true;
    }
    try {
      await this.driveClient.files.delete({ fileId });
      return true;
    } catch (error) {
      this.logger.error(`Error deleting Google Drive file ${fileId}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}
