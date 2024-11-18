import { Controller, Get, Param, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { EspaciosFisicosService } from './espacios-fisicos.service';
import { Observable, map, catchError, of } from 'rxjs';
import { DependenciaSimple, SedeResponse } from '../utils/types';
import { StandardResponse } from '../interfaces/responses.interface';

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
      catchError((error) =>
        of({
          Success: false,
          Status: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          Message: error.message || 'Error al obtener las sedes',
        }),
      ),
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
      catchError((error) =>
        of({
          Success: false,
          Status: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          Message:
            error.message ||
            `Error al obtener las dependencias de la sede ${id}`,
        }),
      ),
    );
  }
}
