import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  counter: number = 0;

  healthCheck() {
    try {
      return {
        Status: 'ok',
        checkCount: this.counter++,
      };
    } catch (error) {
      return {
        Status: 'error',
        error: error.message,
      };
    }
  }
}
