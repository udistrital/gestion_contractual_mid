import {
  Body,
  Controller,
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

const RUTA_CRUD = 'polizas';

@ApiTags('polizas')
@Controller('polizas')
export class PolizasController {
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
    summary: 'Crear póliza (reenvía a gestion_contractual_crud)',
  })
  @ApiBody({
    description: 'Mismo body que POST /polizas del CRUD (CrearPolizaDto)',
  })
  @ApiResponse({ status: 201, description: 'Póliza creada' })
  @ApiResponse({ status: 400, description: 'Body inválido (CRUD)' })
  @ApiResponse({ status: 404, description: 'Contrato no encontrado (CRUD)' })
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
    summary: 'Actualizar póliza (reenvía a gestion_contractual_crud)',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'ID de la póliza' })
  @ApiBody({
    description: 'Mismo body que PUT /polizas/:id del CRUD (parcial)',
  })
  @ApiResponse({ status: 200, description: 'Póliza actualizada' })
  @ApiResponse({ status: 400, description: 'id no entero o body inválido' })
  @ApiResponse({ status: 404, description: 'Póliza no encontrada (CRUD)' })
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
}
