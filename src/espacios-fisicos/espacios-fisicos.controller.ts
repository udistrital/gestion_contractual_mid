import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { EspaciosFisicosService } from './espacios-fisicos.service';
import { Observable, map, catchError } from 'rxjs';

import {
  DependenciaConSedes,
  DependenciaSimple,
  SedeResponse,
  StandardResponse,
} from '../interfaces/responses.interface';

@ApiTags('Espacios Físicos')
@Controller('espacios-fisicos')
export class EspaciosFisicosController {
  constructor(
    private readonly espaciosFisicosService: EspaciosFisicosService,
  ) {}

  @Get('/sedes')
  @ApiOperation({
    summary: 'Obtener sedes',
    description: 'Obtiene todas las sedes activas del sistema',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de sedes obtenida exitosamente',
    schema: {
      allOf: [
        {
          properties: {
            Success: { type: 'boolean', example: true },
            Status: { type: 'number', example: 200 },
            Message: {
              type: 'string',
              example: 'Sedes obtenidas exitosamente',
            },
            Data: {
              type: 'array',
              items: {
                properties: {
                  Id: { type: 'number', example: 1 },
                  Nombre: { type: 'string', example: 'Sede Principal' },
                },
              },
            },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    schema: {
      properties: {
        Success: { type: 'boolean', example: false },
        Status: { type: 'number', example: 404 },
        Message: { type: 'string', example: 'No se encontraron sedes activas' },
      },
    },
  })
  obtenerSedes(): Observable<StandardResponse<SedeResponse[]>> {
    return this.espaciosFisicosService.obtenerSedes().pipe(
      map(
        (data): StandardResponse<SedeResponse[]> => ({
          Success: true,
          Status: HttpStatus.OK,
          Message: 'Sedes obtenidas exitosamente',
          Data: data,
        }),
      ),
      catchError((error) => {
        const response: StandardResponse<SedeResponse[]> = {
          Success: false,
          Status: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          Message: error.message || 'Error al obtener las sedes',
        };
        throw new HttpException(response, response.Status);
      }),
    );
  }

  @Get('/dependencias/:id')
  @ApiOperation({
    summary: 'Obtener una dependencia',
    description:
      'Nombre de la dependencia y sedes a las que está asignada en Oikos. Sirve para precargar la sede a partir de la dependencia guardada en el contrato',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la dependencia',
    required: true,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Dependencia obtenida exitosamente',
    schema: {
      properties: {
        Success: { type: 'boolean', example: true },
        Status: { type: 'number', example: 200 },
        Message: { type: 'string', example: 'Dependencia 20 obtenida exitosamente' },
        Data: {
          properties: {
            id: { type: 'number', example: 20 },
            nombre: { type: 'string', example: 'Facultad de Ingeniería' },
            sedes: {
              type: 'array',
              items: {
                properties: {
                  id: { type: 'number', example: 10 },
                  nombre: { type: 'string', example: 'Sede Calle 40' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'El id no es un número' })
  @ApiNotFoundResponse({
    schema: {
      properties: {
        Success: { type: 'boolean', example: false },
        Status: { type: 'number', example: 404 },
        Message: { type: 'string', example: 'No se encontró la dependencia con ID 20' },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Error al consultar Oikos' })
  obtenerDependencia(
    @Param('id', ParseIntPipe) id: number,
  ): Observable<StandardResponse<DependenciaConSedes>> {
    return this.espaciosFisicosService.obtenerDependenciaPorId(String(id)).pipe(
      map(
        (data): StandardResponse<DependenciaConSedes> => ({
          Success: true,
          Status: HttpStatus.OK,
          Message: `Dependencia ${id} obtenida exitosamente`,
          Data: data,
        }),
      ),
      catchError((error) => {
        const response: StandardResponse<DependenciaConSedes> = {
          Success: false,
          Status: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          Message: error.message || `Error al obtener la dependencia ${id}`,
        };
        throw new HttpException(response, response.Status);
      }),
    );
  }

  @Get('/dependencias-sede/:id')
  @ApiOperation({
    summary: 'Obtener dependencias por sede',
    description:
      'Obtiene todas las dependencias asociadas a una sede específica',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la sede',
    required: true,
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de dependencias obtenida exitosamente',
    schema: {
      allOf: [
        {
          properties: {
            Success: { type: 'boolean', example: true },
            Status: { type: 'number', example: 200 },
            Message: {
              type: 'string',
              example: 'Dependencias obtenidas exitosamente',
            },
            Data: {
              type: 'array',
              items: {
                properties: {
                  id: { type: 'number', example: 1 },
                  nombre: { type: 'string', example: 'Facultad de Ingeniería' },
                },
              },
            },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    schema: {
      properties: {
        Success: { type: 'boolean', example: false },
        Status: { type: 'number', example: 404 },
        Message: { type: 'string', example: 'No se encontraron dependencias' },
      },
    },
  })
  obtenerDependencias(
    @Param('id') id: string,
  ): Observable<StandardResponse<DependenciaSimple[]>> {
    return this.espaciosFisicosService.obtenerDependencias(id).pipe(
      map(
        (data): StandardResponse<DependenciaSimple[]> => ({
          Success: true,
          Status: HttpStatus.OK,
          Message: `Dependencias obtenidas exitosamente para la sede ${id}`,
          Data: data,
        }),
      ),
      catchError((error) => {
        const response: StandardResponse<DependenciaSimple[]> = {
          Success: false,
          Status: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          Message:
            error.message ||
            `Error al obtener las dependencias de la sede ${id}`,
        };
        throw new HttpException(response, response.Status);
      }),
    );
  }
}
