import { Test, TestingModule } from '@nestjs/testing';
import { AmparosContratosController } from './amparos-contratos.controller';
import { ConfigService } from '@nestjs/config';
import { AmparosContratosService } from './amparos-contratos.service';

describe('AmparosContratosController', () => {
  let controller: AmparosContratosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AmparosContratosController],
      providers: [
        { provide: AmparosContratosService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => 'test' } },
      ],
    }).compile();

    controller = module.get<AmparosContratosController>(
      AmparosContratosController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
