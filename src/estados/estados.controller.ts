import {
  Controller,
  Get,
  Query,
  ValidationPipe,
  HttpStatus,
  HttpException,
  Logger,
  Param,
} from '@nestjs/common';
import { EstadosService } from './estados.service';
import { BaseQueryParamsDto } from '../utils/query-params.base.dto';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { StandardResponse } from '../interfaces/responses.interface';

@Controller('estados')
export class EstadosController {
  private readonly logger = new Logger(EstadosController.name);
  constructor(private readonly estadosService: EstadosService) {}

  @Get()
  @ApiOperation({
    summary:
      'Retorna información sobre el estado de los contratos',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de contratos generales',
  })
  async consultarContratos(
    @Query(new ValidationPipe({ transform: true }))
    queryParams: BaseQueryParamsDto,
  ): Promise<StandardResponse<any[]>> {
    try {
      const result = await this.estadosService.getAll(queryParams);

      return {
        Success: true,
        Status: HttpStatus.OK,
        Message: 'Contratos consultados exitosamente',
        Data: result.Data,
        Metadata: result.Metadata,
      };
    } catch (error) {
      this.logger.error(
        `Error en consultarContratos: ${error.message}`,
        error.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          Success: false,
          Status: HttpStatus.INTERNAL_SERVER_ERROR,
          Message: `Error interno del servidor: ${error.message}`,
          Data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

}
