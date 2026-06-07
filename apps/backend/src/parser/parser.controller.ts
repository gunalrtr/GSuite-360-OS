import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ParserService } from './parser.service';

@Controller('parser')
export class ParserController {
  constructor(private readonly parserService: ParserService) {}

  @Post()
  async parseText(@Body() body: { text: string }) {
    if (body.text === undefined) {
      throw new BadRequestException('text field is required');
    }
    return this.parserService.parseText(body.text);
  }
}
