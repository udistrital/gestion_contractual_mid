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
  PaginatedResponse,
  ResponseMetadata,
  UsuarioResponse,
  ParametroResponse,
} from '../interfaces/responses.interface';
import { BaseQueryParamsDto } from '../utils/query-params.base.dto';

@Injectable()
export class EstadosService {
  private readonly logger = new Logger(EstadosService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly parametrosAxiosInstance: AxiosInstance;
  private readonly idsTipoParametro = {
    estadosGenerales: 137,
    estadosInternos: 141,
  } as const;

  constructor(private configService: ConfigService) {
    const timeout = 5000;
    this.axiosInstance = this.createAxiosInstance('ENDP_GESTION_CONTRACTUAL_CRUD', timeout);
    this.parametrosAxiosInstance = this.createAxiosInstance('ENDP_PARAMETROS_CRUD', timeout);
  }

  private createAxiosInstance(baseUrlKey: string, timeout: number): AxiosInstance {
    return axios.create({baseURL: this.configService.get<string>(baseUrlKey), timeout});
  }

  private async fetchWithRetry<T>(axiosCall: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
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

  // Obtener todos los parametros por tipo de parametro
  private async obtenerParametrosPorTipo(tipoParametroId: number): Promise<Map<number, string>> {
    try {
      const response = await this.fetchWithRetry(() =>
        this.parametrosAxiosInstance.get<ParametroResponse>(
          `parametro?query=TipoParametroId:${tipoParametroId}&limit=0`,
        ),
      );
      if (response.data.Status !== '200' || !response.data.Data) {
        throw new Error('Respuesta inválida del servidor de parámetros');
      }
      return new Map(response.data.Data.map((param) => [param.Id, param.Nombre]));
    } catch (error) {
      this.logger.error(`Error al obtener parámetros tipo ${tipoParametroId}: ${error.message}`);
      throw error;
    }
  }

  // Obtener todos los id's y nombres de los estados generales e internos por el tipo de parametro
  private async obtenerEstadosPorTipoParametro(): Promise<Map<number, Map<number, string>>> {
    const estadosPorTipoParametro = new Map<number, Map<number, string>>();
    await Promise.all(
      Object.values(this.idsTipoParametro).map(async (tipoParametroId) => {
        const parametros = await this.obtenerParametrosPorTipo(tipoParametroId);
        estadosPorTipoParametro.set(tipoParametroId, parametros);
      }),
    );
    return estadosPorTipoParametro;
  }

  // Reemplaza los ids de los estados por el nombre del parametro
  // Agrega el nombre del usuario por id
  private async transformarEstados(
    estados: any[],
    estadosPorTipoParametro: Map<number, Map<number, string>>,
  ): Promise<any[]> {
    return await Promise.all(
      estados.map(async (estado) => {
        const estadoTransformado = { ...estado };

        const estadosGenerales = estadosPorTipoParametro.get(this.idsTipoParametro.estadosGenerales);
        if (estadosGenerales && estadoTransformado.estado_parametro_id != null) {
          estadoTransformado.estado_parametro_id =
          estadosGenerales.get(estadoTransformado.estado_parametro_id) ||
            estadoTransformado.estado_parametro_id;
        }

        const estadosInternos = estadosPorTipoParametro.get(this.idsTipoParametro.estadosInternos);
        if (estadosInternos && estadoTransformado.estado_interno_parametro_id != null) {
          estadoTransformado.estado_interno_parametro_id =
          estadosInternos.get(estadoTransformado.estado_interno_parametro_id) ||
            estadoTransformado.estado_interno_parametro_id;   
        }
        
        // Agregar nombre de usuario
        const usuarioId = estado?.usuario_id ?? null;
        if (usuarioId !== null) {
          const usuario = await this.consultarUsuario(usuarioId);
          estadoTransformado.nombre_usuario = usuario.NombreCompleto;
        }
        return estadoTransformado;
      }),
    );
  }

  private async consultarUsuario(id: number): Promise<UsuarioResponse> {
    try {
      const endpoint: string = this.configService.get<string>('ENDP_TERCEROS_CRUD');
      const { data } = await axios.get<UsuarioResponse>(`${endpoint}tercero/${id}`);
      return data;
    } catch (error) {
      return null;
    }
  }

  async getAll(
    queryParams: BaseQueryParamsDto,
  ): Promise<PaginatedResponse<any>> {
    try {
      const queryFilter = queryParams.queryFilter ? JSON.parse(`{${queryParams.queryFilter}}`) : {};
      let params = {
        sortBy: queryParams.sortBy,
        orderBy: queryParams.orderBy,
        limit: queryParams.limit,
        offset: queryParams.offset,
        query: JSON.stringify({ ...queryFilter }), 
      }; 

      const response = await this.fetchWithRetry(() =>
        this.axiosInstance.get<PaginatedResponse<any>>('estados-contrato', { params })
      );

      if (!response.data?.Data) {
        this.logger.warn('Respuesta inválida al consultar los estados de los contratos');
        throw new NotFoundException('Estados de los contratos no encontrados');
      }

      const estadosPorTipoParametro = await this.obtenerEstadosPorTipoParametro();

      const BATCH_SIZE = 25; // Reducido de 50 a 25 por las llamadas adicionales
      const batches = chunk(response.data.Data, BATCH_SIZE);
      const results = await Promise.all(
        batches.map((batch) => this.transformarEstados(batch, estadosPorTipoParametro)),
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
        `Error al consultar los estados de los contratos: ${error.message}`,
      );
    }
  }
}
