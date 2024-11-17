import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { HttpService } from '@nestjs/axios';
import { catchError, map, Observable, throwError } from 'rxjs';
import {
  DependenciaResponse,
  DependenciaSimple,
  SedeResponse,
} from '../utils/types';

@Injectable()
export class EspaciosFisicosService {
  private readonly logger = new Logger(EspaciosFisicosService.name);
  private readonly baseUrl: string;
  private readonly idSedeOikos: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'oikos.espaciosFisicosEndpoint',
    );
    this.idSedeOikos = this.configService.get<number>('oikos.idSedeOikos');

    if (!this.baseUrl) {
      throw new Error('La URL base de Oikos no está configurada');
    }
  }

  /**
   * Obtiene todas las sedes activas
   * @returns Observable<SedeResponse[]>
   */
  obtenerSedes(): Observable<SedeResponse[]> {
    const url = this.buildUrl('espacio_fisico', {
      query: `TipoEspacioFisicoId:${this.idSedeOikos},Activo:true`,
      fields: 'Id,Nombre',
      sortby: 'nombre',
      order: 'asc',
      limit: '0',
    });

    return this.httpService.get<SedeResponse[]>(url).pipe(
      map((response) => {
        if (!response.data?.length) {
          this.logger.warn('No se encontraron sedes activas');
          throw new NotFoundException('No se encontraron sedes activas');
        }
        return response.data;
      }),
      catchError(this.handleError),
    );
  }

  /**
   * Obtiene las dependencias asociadas a un espacio físico
   * @param id ID del espacio físico
   * @returns Observable<DependenciaSimple[]>
   */
  obtenerDependencias(id: string): Observable<DependenciaSimple[]> {
    const url = this.buildUrl('asignacion_espacio_fisico_dependencia', {
      query: `EspacioFisicoId:${id},Activo:true`,
      fields: 'Id,DependenciaId',
      limit: '0',
    });

    return this.httpService.get<DependenciaResponse[]>(url).pipe(
      map((response) => {
        if (!response.data?.length) {
          this.logger.warn(
            `No se encontraron dependencias para el espacio físico ${id}`,
          );
          throw new NotFoundException(
            `No se encontraron dependencias para el espacio físico ${id}`,
          );
        }

        // Verificamos que los datos tengan la estructura esperada
        const datosValidos = response.data.every(
          (item) =>
            item.DependenciaId &&
            item.DependenciaId.Id &&
            item.DependenciaId.Nombre,
        );

        if (!datosValidos) {
          this.logger.error(
            `Datos incompletos o malformados para el espacio físico ${id}`,
          );
          throw new InternalServerErrorException(
            'Error en el formato de los datos recibidos',
          );
        }

        return this.mapearDependencias(response.data);
      }),
      catchError(this.handleError),
    );
  }

  /**
   * Construye la URL con los parámetros necesarios
   */
  private buildUrl(path: string, params: Record<string, string>): string {
    const queryParams = new URLSearchParams(params).toString();
    return `${this.baseUrl}${path}?${queryParams}`;
  }

  /**
   * Maneja los errores de las peticiones HTTP y del negocio
   */
  private handleError = (error: Error | AxiosError) => {
    // Si es un NotFoundException propio, lo propagamos
    if (error instanceof NotFoundException) {
      return throwError(() => error);
    }

    // Si es un error de Axios
    if (axios.isAxiosError(error)) {
      this.logger.error(`Error en la petición HTTP: ${error.message}`);
      if (error.response?.data) {
        this.logger.error(
          `Detalles del error: ${JSON.stringify(error.response.data)}`,
        );
      }

      if (error.response?.status === 404) {
        return throwError(() => new NotFoundException('Recurso no encontrado'));
      }

      return throwError(
        () =>
          new InternalServerErrorException(
            `Error en la comunicación con el servicio: ${error.message}`,
          ),
      );
    }

    // Para otros tipos de errores
    this.logger.error(`Error inesperado: ${error.message}`);
    return throwError(
      () => new InternalServerErrorException('Error interno del servidor'),
    );
  };

  /**
   * Mapea la respuesta de dependencias al formato simplificado
   */
  /**
   * Mapea y ordena la respuesta de dependencias al formato simplificado
   * @param response Array de dependencias de la API
   * @returns Array ordenado de dependencias simplificadas
   */
  private mapearDependencias(
    response: DependenciaResponse[],
  ): DependenciaSimple[] {
    return response
      .map((item) => ({
        id: item.DependenciaId.Id,
        nombre: item.DependenciaId.Nombre,
      }))
      .sort((a, b) =>
        a.nombre.localeCompare(b.nombre, 'es', {
          sensitivity: 'base',
          ignorePunctuation: true,
        }),
      );
  }
}
