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

  private readonly UNIDADES = [
    '', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
    'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'
  ];

  private readonly DECENAS = [
    '', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'
  ];

  private readonly CENTENAS = [
    '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'
  ];

  private convertirGrupo(n: number): string {
    let resultado = '';
    if (n === 0) return '';
    if (n === 100) return 'cien';
    const centenas = Math.floor(n / 100);
    if (centenas > 0) {
      resultado += this.CENTENAS[centenas] + ' ';
    }

    const decenas = n % 100;
    if (decenas > 0) {
      if (decenas < 20) {
        resultado += this.UNIDADES[decenas];
      } else {
        const unidades = decenas % 10;
        const decenasPiso = Math.floor(decenas / 10);
        if (unidades === 0) {
          resultado += this.DECENAS[decenasPiso];
        } else {
          resultado += this.DECENAS[decenasPiso] + ' y ' + this.UNIDADES[unidades].toLowerCase();
        }
      }
    }

    return resultado.trim();
  }

  private numeroATexto(numero: number): string {
    if (numero === 0) return 'cero';
    if (numero < 0) return 'Menos ' + this.numeroATexto(Math.abs(numero));

    let resultado = '';
    let billones = Math.floor(numero / 1000000000000);
    let millones = Math.floor((numero % 1000000000000) / 1000000);
    let miles = Math.floor((numero % 1000000) / 1000);
    let resto = numero % 1000;

    if (billones > 0) {resultado += this.convertirGrupo(billones) + ' billon' + (billones > 1 ? 'es ' : ' ');}
    if (millones > 0) {resultado += this.convertirGrupo(millones) + ' millon' + (millones > 1 ? 'es ' : ' ');}
    if (miles > 0) {resultado += this.convertirGrupo(miles) + ' mil ';}
    if (resto > 0) {resultado += this.convertirGrupo(resto);}

    return resultado.trim();
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

        if (contratoTransformado.valorPesos) {
          contratoTransformado.valorPesosTexto = this.numeroATexto(contratoTransformado.valorPesos) + ' Pesos';
          console.log(contratoTransformado.valorPesosTexto);
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
      console.log(this.numeroATexto(35740150));
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
