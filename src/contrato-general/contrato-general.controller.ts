import {
  Controller,
  Get,
  Query,
  Param,
  ValidationPipe,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ContratoGeneralService } from './contrato-general.service';
import { ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { BaseQueryParamsDto } from '../utils/query-params.base.dto';
import { StandardResponse } from '../interfaces/responses.interface';

@Controller('contratos-generales')
export class ContratoGeneralController {
  private readonly logger = new Logger(ContratoGeneralController.name);

  constructor(
    private readonly contratoGeneralService: ContratoGeneralService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Retorna información de contratos generales con filtros y paginación',
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
      const result = await this.contratoGeneralService.getAll(queryParams);

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

  @Get(':id')
  @ApiOperation({ summary: 'Retorna información de contrato-general por ID' })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del contrato general',
  })
  async consultarInfoContrato(
    @Param('id') id: string,
  ): Promise<StandardResponse<any>> {
    try {
      const result =
        await this.contratoGeneralService.getContratoTransformed(+id);

      return {
        Success: true,
        Status: HttpStatus.OK,
        Message: 'Contrato consultado exitosamente',
        Data: result,
      };
    } catch (error) {
      this.logger.error(
        `Error en consultarInfoContrato: ${error.message}`,
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
