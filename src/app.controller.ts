import { Controller, Get } from '@nestjs/common';

@Controller('app')
export class AppController {
  @Get('hello')
  getHello(): string {
    return 'Hello World!';
  }

  @Get('error')
  getError(): string {
    throw new Error('error');
  }
}
