import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CaptchaService } from './captcha.service';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { CaptchaDto } from './dto/captcha.dto';

@ApiTags('Auth')
@Controller('auth')
export class CaptchaController {
  constructor(private captchaService: CaptchaService) {}

  @Get('captcha')
  @ApiOperation({ summary: 'Get a captcha' })
  getCaptcha(): Promise<CaptchaDto> {
    return this.captchaService.getCaptcha();
  }
}
