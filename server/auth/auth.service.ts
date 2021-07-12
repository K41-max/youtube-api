import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService
  ) {}

  async validateUser(username: string, pw: string) {
    const user = await this.userService.findOne(username);
    if (user) {
      try {
        const comparison = await bcrypt.compare(pw, user.password);
        if (comparison === true) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { password, ...result } = user;
          return result;
        }
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  getDeletionCookie() {
    let domainString = '';
    if (this.configService.get('NODE_ENV') === 'production') {
      domainString = `Domain=${this.configService.get('VIEWTUBE_CURRENT_DOMAIN')}; `;
    }
    const expiration = 0;
    return `Authentication=; HttpOnly=true; Secure=true; Path=/; ${domainString}Max-Age=${expiration}`;
  }

  getJwtCookie(username: string) {
    const { accessToken } = this.login(username);
    let domainString = '';
    let secureString = '';
    if (this.configService.get('NODE_ENV') === 'production') {
      domainString = `Domain=${this.configService.get('VIEWTUBE_CURRENT_DOMAIN')}; `;
      secureString = 'Secure=true; ';
    }
    const expiration = this.configService.get('VIEWTUBE_JWT_EXPIRATION_TIME');
    return `Authentication=${accessToken}; HttpOnly=true; Path=/; ${secureString}${domainString}Max-Age=${expiration}`;
  }

  login(username: string) {
    return {
      accessToken: this.jwtService.sign({ username })
    };
  }
}
