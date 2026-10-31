import { Module } from '@nestjs/common';
import { EstadosService } from './estados.service';
import { EstadosController } from './estados.controller';
import { ParametroModule } from '../parametro/parametro.module';

@Module({
  imports: [ParametroModule],
  controllers: [EstadosController],
  providers: [EstadosService],
})
export class EstadosModule {}
