import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ContratoGeneralModule } from './contrato-general/contrato-general.module';
import { ParametroModule } from './parametro/parametro.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ContratoGeneralModule,
    ParametroModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
