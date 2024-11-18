import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { chunk, flatten } from 'lodash';
import {
  EstadoContratoResponse,
  PaginatedResponse,
  ResponseMetadata,
} from '../interfaces/responses.interface';
import { BaseQueryParamsDto } from '../utils/query-params.base.dto';

interface ParametroResponse {
  Status: string;
  Data: Array<{
    Id: number;
    Nombre: string;
    [key: string]: any;
  }>;
}

interface ContratoResponse {
  Status: string;
  Data: any;
}

@Injectable()
export class ContratoGeneralService {
  private readonly logger = new Logger(ContratoGeneralService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly parametrosAxiosInstance: AxiosInstance;

  constructor(private configService: ConfigService) {
    this.axiosInstance = axios.create({
      baseURL: this.configService.get<string>('ENDP_GESTION_CONTRACTUAL_CRUD'),
      timeout: 5000,
    });

    this.parametrosAxiosInstance = axios.create({
      baseURL: this.configService.get<string>('ENDP_PARAMETROS_CRUD'),
      timeout: 5000,
    });
  }

  private readonly parameterMap = {
    tipoCompromisoId: 111,
    tipoContratoId: 112,
    perfilContratistaId: 113,
    tipologiaEspecificaId: 114,
    modalidadSeleccionId: 115,
    regimenContratacionId: 116,
    procedimientoId: 117,
    claseContratistaId: 120,
    tipoMonedaId: 122,
    tipoGastoId: 123,
    origenRecursosId: 124,
    origenPresupuestosId: 125,
    temaGastoInversionId: 126,
    medioPogoId: 127,
    unidadEjecutoraId: 7,
  } as const;

  private async fetchWithRetry<T>(
    axiosCall: () => Promise<T>,
    retries = 3,
    delay = 1000,
  ): Promise<T> {
    try {
      return await axiosCall();
    } catch (error) {
      if (retries > 0 && axios.isAxiosError(error)) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(axiosCall, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  async consultarInfoContrato(id: number): Promise<any> {
    try {
      const response = await this.fetchWithRetry(() =>
        this.axiosInstance.get<ContratoResponse>(`contratos-generales/${id}`),
      );

      if (!response.data?.Data) {
        this.logger.warn(`Respuesta inválida para el contrato ${id}`);
        throw new NotFoundException(
          `Contrato general con ID ${id} no encontrado o respuesta inválida`,
        );
      }

      return response.data.Data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new NotFoundException(
            `Contrato general con ID ${id} no encontrado`,
          );
        }
        this.logger.error(
          `Error al consultar el contrato ${id}: ${JSON.stringify(error.response?.data)}`,
        );
      }
      throw new InternalServerErrorException(
        `Error al consultar el contrato: ${error.message}`,
      );
    }
  }

  private async obtenerParametrosPorTipo(
    tipoParametroId: number,
  ): Promise<Map<number, string>> {
    try {
      const response = await this.fetchWithRetry(() =>
        this.parametrosAxiosInstance.get<ParametroResponse>(
          `parametro?query=TipoParametroId:${tipoParametroId}&limit=0`,
        ),
      );

      if (response.data.Status !== '200' || !response.data.Data) {
        throw new Error('Respuesta inválida del servidor de parámetros');
      }

      return new Map(
        response.data.Data.map((param) => [param.Id, param.Nombre]),
      );
    } catch (error) {
      this.logger.error(
        `Error al obtener parámetros tipo ${tipoParametroId}: ${error.message}`,
      );
      throw error;
    }
  }

  private async cargarCacheParametros(): Promise<
    Map<number, Map<number, string>>
  > {
    const tiposParametros = new Set(Object.values(this.parameterMap));
    const cacheParametros = new Map<number, Map<number, string>>();

    await Promise.all(
      Array.from(tiposParametros).map(async (tipoParametroId) => {
        const parametros = await this.obtenerParametrosPorTipo(tipoParametroId);
        cacheParametros.set(tipoParametroId, parametros);
      }),
    );

    return cacheParametros;
  }

  private async transformarContratos(
    contratos: any[],
    cacheParametros: Map<number, Map<number, string>>,
  ): Promise<any[]> {
    const contratosConEstado = await Promise.all(
      contratos.map(async (contratoRaw) => {
        const contratoTransformado = { ...contratoRaw };

        // Transformación existente de parámetros
        Object.entries(this.parameterMap).forEach(([key, tipoParametroId]) => {
          if (contratoRaw[key] != null) {
            const parametrosMap = cacheParametros.get(tipoParametroId);
            if (parametrosMap && parametrosMap.has(contratoRaw[key])) {
              contratoTransformado[key] = parametrosMap.get(contratoRaw[key]);
            }
          }
        });

        // Agregar estado
        const estado = await this.consultarEstadoContrato(contratoRaw.id);
        if (estado !== null) {
          contratoTransformado.estado = estado;
        }

        return contratoTransformado;
      }),
    );

    return contratosConEstado;
  }

  async getAll(
    queryParams: BaseQueryParamsDto,
  ): Promise<PaginatedResponse<any>> {
    try {
      const response = await this.fetchWithRetry(() =>
        this.axiosInstance.get<PaginatedResponse<any>>('contratos-generales', {
          params: queryParams,
        }),
      );

      if (!response.data?.Data) {
        this.logger.warn('Respuesta inválida al consultar contratos generales');
        throw new NotFoundException('Contratos generales no encontrados');
      }

      const cacheParametros = await this.cargarCacheParametros();

      const BATCH_SIZE = 25; // Reducido de 50 a 25 por las llamadas adicionales
      const batches = chunk(response.data.Data, BATCH_SIZE);

      const results = await Promise.all(
        batches.map((batch) =>
          this.transformarContratos(batch, cacheParametros),
        ),
      );

      const metadata: ResponseMetadata = response.data.Metadata || {
        total: response.data.Data.length,
        limit: queryParams.limit || 10,
        offset: queryParams.offset || 0,
        currentPage:
          Math.floor((queryParams.offset || 0) / (queryParams.limit || 10)) + 1,
        totalPages: Math.ceil(
          response.data.Data.length / (queryParams.limit || 10),
        ),
        hasNextPage:
          (queryParams.offset || 0) + (queryParams.limit || 10) <
          response.data.Data.length,
        hasPreviousPage: (queryParams.offset || 0) > 0,
      };

      return {
        Data: flatten(results),
        Metadata: metadata,
      };
    } catch (error) {
      this.logger.error('Error en getAll:', error);
      throw new InternalServerErrorException(
        `Error al consultar contratos generales: ${error.message}`,
      );
    }
  }

  async getContratoTransformed(id: number): Promise<any> {
    try {
      const contratoRaw = await this.consultarInfoContrato(id);
      const cacheParametros = await this.cargarCacheParametros();
      const [contratoTransformado] = await this.transformarContratos(
        [contratoRaw],
        cacheParametros,
      );
      return contratoTransformado;
    } catch (error) {
      this.logger.error(
        `Error en getContratoTransformed para ID ${id}:`,
        error,
      );
      throw error;
    }
  }

  private async consultarEstadoContrato(id: number): Promise<string | null> {
    try {
      const response = await this.fetchWithRetry(() =>
        this.axiosInstance.get<EstadoContratoResponse>(`estados-contrato/${id}`),
      );

      if (!response?.data) {
        this.logger.warn(`Estado no encontrado para el contrato ${id}`);
        return null;
      }

      return response.data.motivo;
    } catch (error) {
      this.logger.warn(
        `Error al consultar estado del contrato ${id}: ${error.message}`,
      );
      return null;
    }
  }
}
