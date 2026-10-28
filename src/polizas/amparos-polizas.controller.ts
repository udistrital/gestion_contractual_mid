import {
  Body,
  Controller,
  Delete,
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

const RUTA_CRUD = 'amparos-polizas';

@ApiTags('amparos-polizas')
@Controller('amparos-polizas')
export class AmparosPolizasController {
  private readonly logger = new Logger(AmparosPolizasController.name);

  constructor(private readonly polizasService: PolizasService) {}

  @Get()
  @ApiOperation({
    summary:
      'Consultar amparos de pólizas (reenvía a gestion_contractual_crud)',
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
  @ApiResponse({ status: 200, description: 'Amparos encontrados' })
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
          Message: 'Error al procesar amparos de pólizas',
          Data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  @ApiOperation({
    summary: 'Crear amparos en lote (reenvía a gestion_contractual_crud)',
  })
  @ApiBody({
    description:
      'Arreglo con el mismo formato que POST /amparos-polizas del CRUD (CrearAmparoPolizaDto[])',
  })
  @ApiResponse({
    status: 201,
    description:
      'Amparos creados; en creación parcial el body trae Status = 206 y Data = { creados, errores }',
  })
  @ApiResponse({ status: 400, description: 'Body inválido (CRUD)' })
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
          Message: 'Error al procesar amparos de pólizas',
          Data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  @ApiOperation({
    summary:
      'Actualizar amparo o vincularlo a una póliza (reenvía a gestion_contractual_crud)',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'ID del amparo' })
  @ApiBody({
    description: 'Mismo body que PUT /amparos-polizas/:id del CRUD (parcial)',
  })
  @ApiResponse({ status: 200, description: 'Amparo actualizado' })
  @ApiResponse({ status: 400, description: 'id no entero o body inválido' })
  @ApiResponse({ status: 404, description: 'Amparo no encontrado (CRUD)' })
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
          Message: 'Error al procesar amparos de pólizas',
          Data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Eliminar amparo, borrado lógico (reenvía a gestion_contractual_crud)',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'ID del amparo' })
  @ApiResponse({ status: 200, description: 'Amparo eliminado (activo=false)' })
  @ApiResponse({ status: 400, description: 'id no entero' })
  @ApiResponse({ status: 404, description: 'Amparo no encontrado (CRUD)' })
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    try {
      const { body: respuesta } = await this.polizasService.eliminar(
        RUTA_CRUD,
        id,
      );
      return respuesta;
    } catch (error) {
      this.logger.error(`Error en eliminar: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          Success: false,
          Status: HttpStatus.INTERNAL_SERVER_ERROR,
          Message: 'Error al procesar amparos de pólizas',
          Data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
