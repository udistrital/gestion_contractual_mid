import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { PolizasService } from './polizas.service';

const RUTA_CRUD = 'amparos-polizas';

@ApiTags('amparos-polizas')
@Controller('amparos-polizas')
export class AmparosPolizasController {
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
  async consultar(
    @Query() params: Record<string, any>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { status, body } = await this.polizasService.consultar(
      RUTA_CRUD,
      params,
    );
    res.status(status);
    return body;
  }

  @Post()
  @ApiOperation({
    summary: 'Crear amparos en lote (reenvía a gestion_contractual_crud)',
  })
  @ApiBody({
    description:
      'Arreglo con el mismo formato que POST /amparos-polizas del CRUD (CrearAmparoPolizaDto[])',
  })
  @ApiResponse({ status: 201, description: 'Todos los amparos creados' })
  @ApiResponse({
    status: 206,
    description: 'Creación parcial: Data = { creados, errores }',
  })
  @ApiResponse({ status: 400, description: 'Body inválido (CRUD)' })
  async crear(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const { status, body: respuesta } = await this.polizasService.crear(
      RUTA_CRUD,
      body,
    );
    res.status(status);
    return respuesta;
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
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { status, body: respuesta } = await this.polizasService.actualizar(
      RUTA_CRUD,
      id,
      body,
    );
    res.status(status);
    return respuesta;
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
  async eliminar(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { status, body } = await this.polizasService.eliminar(RUTA_CRUD, id);
    res.status(status);
    return body;
  }
}
