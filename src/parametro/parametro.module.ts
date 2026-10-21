import { Module } from '@nestjs/common';
import { ParametroService } from './parametro.service';
import { ParametrosController } from './parametro.controller';

@Module({
  controllers: [ParametrosController],
  providers: [ParametroService],
})
export class ParametroModule {}
