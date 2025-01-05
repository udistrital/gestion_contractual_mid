import { Module } from '@nestjs/common';
import { SupervisoresService } from './supervisores.service';
import { SupervisoresController } from './supervisores.controller';
import { ParametroService } from '../parametro/parametro.service';
import { EspaciosFisicosModule } from '../espacios-fisicos/espacios-fisicos.module';

@Module({
  imports: [EspaciosFisicosModule],
  controllers: [SupervisoresController],
  providers: [SupervisoresService, ParametroService],
})
export class SupervisoresModule {}
