import { Module } from '@nestjs/common';
import { AmparosContratosService } from './amparos-contratos.service';
import { AmparosContratosController } from './amparos-contratos.controller';

@Module({
  controllers: [AmparosContratosController],
  providers: [AmparosContratosService],
})
export class AmparosContratosModule {}
