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
import { ContratoGeneralService } from './contrato-general.service';
import { BaseQueryParamsDto } from '../utils/query-params.base.dto';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { StandardResponse } from '../interfaces/responses.interface';
import { ParametrosConsultarContratoDto } from './dto/params.dto';

@Controller('contratos-generales')
export class ContratoGeneralController {
  private readonly logger = new Logger(ContratoGeneralController.name);

  constructor(
    private readonly contratoGeneralService: ContratoGeneralService,
  ) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Retorna información de contrato-general por ID.',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna detalle de un contrato-general.',
  })
  @ApiResponse({ status: 400, description: 'Error en la solicitud.' })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del contrato general',
  })
  async consultarInfoContrato(
    @Param(ValidationPipe) param: ParametrosConsultarContratoDto,
  ): Promise<StandardResponse<any>> {
    try {
      const result = await this.contratoGeneralService.getContratoTransformed(
        +param.id,
      );

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

  @Get('con-ids')
  @ApiOperation({
    summary:
      'Retorna información de contratos generales manteniendo los IDs originales',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de contratos generales con IDs y valores descriptivos',
  })
  async consultarContratosConIds(
    @Query(new ValidationPipe({ transform: true }))
    queryParams: BaseQueryParamsDto,
  ): Promise<StandardResponse<any[]>> {
    try {
      const result =
        await this.contratoGeneralService.getAllWithIds(queryParams);

      return {
        Success: true,
        Status: HttpStatus.OK,
        Message: 'Contratos consultados exitosamente',
        Data: result.Data,
        Metadata: result.Metadata,
      };
    } catch (error) {
      this.logger.error(
        `Error en consultarContratosConIds: ${error.message}`,
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
