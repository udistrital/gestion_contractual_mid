import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let appService: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    appService = module.get<AppService>(AppService);
  });

  it('Debe estar definido', () => {
    expect(appService).toBeDefined();
  });

  describe('healthCheck', () => {
    it('Debe retornar el objeto correcto', () => {
      const result1 = appService.healthCheck();
      expect(result1).toEqual({ Status: 'ok', checkCount: 0 });

      const result2 = appService.healthCheck();
      expect(result2).toEqual({ Status: 'ok', checkCount: 1 });

      const result3 = appService.healthCheck();
      expect(result3).toEqual({ Status: 'ok', checkCount: 2 });
    });

    it('Debe retornar el objeto error', () => {
      Object.defineProperty(appService, 'counter', {
        get: () => {
          throw new Error('Test error');
        },
      });

      const result = appService.healthCheck();
      expect(result).toEqual({ Status: 'error', error: 'Test error' });
    });
  });
});
