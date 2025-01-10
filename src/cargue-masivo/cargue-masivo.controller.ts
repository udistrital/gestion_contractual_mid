import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CargueMasivoService } from './cargue-masivo.service';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Controller('cargue-masivo')
export class CargueMasivoController {
  private cargueMasivoUrl = this.configService.get<string>(
    'CARGUE_MASIVO_MID_SERVERLESS',
  );

  constructor(
    private readonly configService: ConfigService,
    private readonly cargueMasivoService: CargueMasivoService,
  ) {}

  @Post('especificaciones-tecnicas')
  async cargueMasivo(@Body() payload: any): Promise<any> {
    try {
      const { base64data, complement } = payload;
      const estructura = await this.cargueMasivoService.crearEstructura(
        base64data,
        complement,
      );
      const response = await axios.post(
        `${this.cargueMasivoUrl}registro-datos-archivo`,
        estructura,
      );
      return response.data;
    } catch (error) {
      console.error('Error procesando la solicitud:', error);
      if (axios.isAxiosError(error) && error.response) {
        throw new HttpException(
          `Error en el serverless: ${error.response.data.message || error.response.statusText}`,
          error.response.status,
        );
      }
      throw new HttpException(
        'Error procesando la solicitud',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
