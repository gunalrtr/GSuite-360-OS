import { Controller, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('query')
  async handleQuery(
    @Body('userId') userId: string,
    @Body('query') queryText: string,
  ) {
    if (!queryText) {
      throw new BadRequestException('query is required');
    }
    const activeUserId = userId || 'mock-user-uuid';
    const answer = await this.aiService.resolveQuery(activeUserId, queryText);
    return { success: true, query: queryText, answer };
  }
}
