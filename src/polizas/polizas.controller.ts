import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PolizasService } from './polizas.service';

const RUTA_CRUD = 'polizas';

@ApiTags('polizas')
@Controller('polizas')
export class PolizasController {
  private readonly logger = new Logger(PolizasController.name);

  constructor(private readonly polizasService: PolizasService) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar pólizas (reenvía a gestion_contractual_crud)',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    description: 'Filtro JSON, ej. {"contrato_general_id":1,"activo":true}',
  })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'orderBy', required: false, enum: ['ASC', 'DESC'] })
  @ApiQuery({ name: 'fields', required: false })
  @ApiQuery({ name: 'include', required: false })
  @ApiResponse({ status: 200, description: 'Pólizas encontradas' })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos (CRUD)' })
  async consultar(@Query() params: Record<string, any>) {
    try {
      const { body: respuesta } = await this.polizasService.consultar(
        RUTA_CRUD,
        params,
      );
      return respuesta;
    } catch (error) {
      this.logger.error(`Error en consultar: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          Success: false,
          Status: HttpStatus.INTERNAL_SERVER_ERROR,
          Message: 'Error al procesar pólizas',
          Data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  @ApiOperation({
    summary: 'Crear póliza (reenvía a gestion_contractual_crud)',
  })
  @ApiBody({
    description: 'Mismo body que POST /polizas del CRUD (CrearPolizaDto)',
  })
  @ApiResponse({ status: 201, description: 'Póliza creada' })
  @ApiResponse({ status: 400, description: 'Body inválido (CRUD)' })
  @ApiResponse({ status: 404, description: 'Contrato no encontrado (CRUD)' })
  async crear(@Body() body: any) {
    try {
      const { body: respuesta } = await this.polizasService.crear(
        RUTA_CRUD,
        body,
      );
      return respuesta;
    } catch (error) {
      this.logger.error(`Error en crear: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          Success: false,
          Status: HttpStatus.INTERNAL_SERVER_ERROR,
          Message: 'Error al procesar pólizas',
          Data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar póliza (reenvía a gestion_contractual_crud)',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'ID de la póliza' })
  @ApiBody({
    description: 'Mismo body que PUT /polizas/:id del CRUD (parcial)',
  })
  @ApiResponse({ status: 200, description: 'Póliza actualizada' })
  @ApiResponse({ status: 400, description: 'id no entero o body inválido' })
  @ApiResponse({ status: 404, description: 'Póliza no encontrada (CRUD)' })
  async actualizar(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    try {
      const { body: respuesta } = await this.polizasService.actualizar(
        RUTA_CRUD,
        id,
        body,
      );
      return respuesta;
    } catch (error) {
      this.logger.error(`Error en actualizar: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          Success: false,
          Status: HttpStatus.INTERNAL_SERVER_ERROR,
          Message: 'Error al procesar pólizas',
          Data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
