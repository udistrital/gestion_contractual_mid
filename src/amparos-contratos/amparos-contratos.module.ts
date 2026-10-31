import { Module } from '@nestjs/common';
import { AmparosContratosService } from './amparos-contratos.service';
import { AmparosContratosController } from './amparos-contratos.controller';
import { ParametroModule } from 'src/parametro/parametro.module';

@Module({
  imports: [ParametroModule],
  controllers: [AmparosContratosController],
  providers: [AmparosContratosService],
})
export class AmparosContratosModule {}
