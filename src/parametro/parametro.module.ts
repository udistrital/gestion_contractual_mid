import { Module } from '@nestjs/common';
import { ParametroService } from './parametro.service';

@Module({
  providers: [ParametroService],
})
export class ParametroModule {}
