import { Module } from '@nestjs/common';
import { EspaciosFisicosService } from './espacios-fisicos.service';
import { EspaciosFisicosController } from './espacios-fisicos.controller';
import { oikosConfig } from '../config/oikos.config';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forFeature(oikosConfig),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  controllers: [EspaciosFisicosController],
  providers: [EspaciosFisicosService],
  exports: [EspaciosFisicosService],
})
export class EspaciosFisicosModule {}
