import { Test, TestingModule } from '@nestjs/testing';
import { AmparosContratosService } from './amparos-contratos.service';
import { ConfigService } from '@nestjs/config';

describe('AmparosContratosService', () => {
  let service: AmparosContratosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AmparosContratosService,
        { provide: ConfigService, useValue: { get: () => 'test' } },
      ],
    }).compile();

    service = module.get<AmparosContratosService>(AmparosContratosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
