import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Query,
} from '@nestjs/common';
import { ParametroService } from './parametro.service';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

@Controller('parametros')
export class ParametrosController {
  private readonly logger = new Logger(ParametrosController.name);

  constructor(private readonly parametrosService: ParametroService) {}

  @Get()
  @ApiOperation({
    summary: 'Retorna los parámetros de los tipos indicados por los IDs.',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna los listados de parámetros solicitados.',
  })
  @ApiResponse({
    status: 400,
    description: 'Falta el parámetro ids o contiene valores no numéricos.',
  })
  @ApiResponse({
    status: 500,
    description: 'Error al consultar el servicio de parámetros.',
  })
  @ApiQuery({
    name: 'ids',
    type: 'string',
    required: true,
    example: '137,141',
    description:
      'ID del/los tipo(s) de parámetro(s) solicitado(s) separados por coma',
  })
  async obtenerParametrosPorTipo(@Query('ids') ids: string) {
    const arregloIds = (ids ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id !== '');

    if (arregloIds.length === 0 || arregloIds.some((id) => !/^\d+$/.test(id))) {
      throw new BadRequestException({
        Success: false,
        Status: HttpStatus.BAD_REQUEST,
        Message:
          'El parámetro ids es obligatorio y debe contener IDs numéricos separados por coma',
        Data: null,
      });
    }

    try {
      const result =
        await this.parametrosService.getParametrosPorTipoId(arregloIds);

      return {
        Success: true,
        Status: HttpStatus.OK,
        Message: 'Parametros consultados exitosamente',
        Data: result,
      };
    } catch (error: any) {
      this.logger.error(
        `Error al consultar los parámetros ${arregloIds.join(',')}: ${error?.message}`,
        error?.stack,
      );
      throw new InternalServerErrorException({
        Success: false,
        Status: HttpStatus.INTERNAL_SERVER_ERROR,
        Message: 'Error al consultar el Caché de parametros',
        Data: null,
      });
    }
  }

  @Delete()
  @ApiOperation({
    summary: 'Limpia la memoria caché de los tipos de parámetro.',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna el estado final de la solicitud.',
  })
  @ApiResponse({ status: 500, description: 'Error al limpiar la caché.' })
  async limpiarCacheParametros() {
    try {
      await this.parametrosService.limpiarCache();
      return {
        Success: true,
        Status: HttpStatus.OK,
        Message: 'Caché de parametros limpiado exitosamente',
      };
    } catch (error: any) {
      this.logger.error(
        `Error al limpiar la caché de parámetros: ${error?.message}`,
        error?.stack,
      );
      throw new InternalServerErrorException({
        Success: false,
        Status: HttpStatus.INTERNAL_SERVER_ERROR,
        Message: 'Error al limpiar el Caché de parametros',
        Data: null,
      });
    }
  }
}
