import {
  BadRequestException,
  HttpException,
  HttpStatus,
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
  ContratoResponse,
  ParametroBase,
} from '../interfaces/responses.interface';
import { BaseQueryParamsDto } from '../utils/query-params.base.dto';
import { datos } from './conf';
import { ParametroService } from '../parametro/parametro.service';
import { createAxiosInstance, fetchWithRetry } from 'src/utils/axios-utils';
import { RECURSOS_CRUD } from '../utils/recursos-crud.constants';
import { environment } from 'src/environments/environment';
import { RegistrarEstadoContratoDto } from './dto/registrar-estado.dto';

@Injectable()
export class ContratoGeneralService {
  private readonly logger = new Logger(ContratoGeneralService.name);
  private readonly gestionContractualCrud: AxiosInstance;

  constructor(
    private readonly configService: ConfigService,
    private readonly parametrosCrud: ParametroService
  ) {
    this.gestionContractualCrud = createAxiosInstance(
      this.configService,
      'GESTION_CONTRACTUAL_CRUD_SERVICE',
    );
  }

  private readonly parameterMap = {
    tipo_compromiso_id: 111,
    tipo_contrato_id: 112,
    perfil_contratista_id: 113,
    tipologia_especifica_id: 114,
    modalidad_seleccion_id: 115,
    regimen_contratacion_id: 116,
    procedimiento_id: 117,
    clase_proveedor_id: 120,
    tipo_moneda_id: 122,
    tipo_gasto_id: 123,
    origen_recursos_id: 124,
    origen_presupuesto_id: 125,
    tema_gasto_inversion_id: 126,
    medio_pago_id: 127,
    unidad_ejecutora_id: 146,
    estado_contrato_id: 137,
    tipo_persona_id: 132,
  } as const;


  async consultarInfoContrato(id: number): Promise<any> {
    try {
      const response = await fetchWithRetry(() =>
        this.gestionContractualCrud.get<ContratoResponse>(
          `${RECURSOS_CRUD.contratoGeneral}/${id}`,
        ),
      );

      if (!response.data?.Data) {
        this.logger.warn(`Respuesta inválida para el contrato ${id}`);
        throw new NotFoundException(
          `Contrato general con ID ${id} no encontrado o respuesta inválida`,
        );
      }

      return response.data.Data;
    } catch (error: any) {
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

  private async cargarCacheParametros(): Promise<
    Map<number, Map<number, ParametroBase>>
  > {
    const tipoParametroId = new Array(Object.values(this.parameterMap))[0];
    
    const tipoParametroIds = tipoParametroId.map(t => t.toString())
    
    const parametros = await this.parametrosCrud.getParametrosIndexados(tipoParametroIds);

    return parametros;
  }

  private async transformarContratos(
    contratos: any[],
    cacheParametros: Map<number, Map<number, ParametroBase>>,
    ids: boolean = false,
  ): Promise<any[]> {
    const contratosNormales = await Promise.all(
      contratos.map(async (contratoRaw) => {
        const contratoTransformado = { ...contratoRaw };

        Object.entries(this.parameterMap).forEach(([key, tipoParametroId]) => {
          if (contratoRaw[key] != null && key.endsWith('_id')) {
            const parametrosMap = cacheParametros.get(tipoParametroId);
            const newKey = key.replace('_id', '');

            if (parametrosMap && parametrosMap.has(contratoRaw[key])) {
              contratoTransformado[ids ? newKey : key] = parametrosMap.get(
                contratoRaw[key],
              )?.Nombre;
            }
          }
        });

        if (contratoTransformado.estados) {
          const estadoParametroMap = cacheParametros.get(
            this.parameterMap.estado_contrato_id,
          );
          if (
            estadoParametroMap &&
            contratoTransformado.estados.estado_parametro_id != null
          ) {
            ids
              ? contratoTransformado.estados.estado_parametro
              : (contratoTransformado.estados.estado_parametro_id =
                  estadoParametroMap.get(
                    contratoTransformado.estados.estado_parametro_id,
                  )?.Nombre ?? contratoTransformado.estados.estado_parametro_id);
          }
        }

        if (contratoTransformado.contratista) {
          const tipoPersonaMap = cacheParametros.get(
            this.parameterMap.tipo_persona_id,
          );
          if (
            tipoPersonaMap &&
            contratoTransformado.contratista.tipo_persona_id != null
          ) {
            ids
              ? contratoTransformado.contratista.tipo_persona
              : (contratoTransformado.contratista.tipo_persona_id =
                  tipoPersonaMap.get(
                    contratoTransformado.contratista.tipo_persona_id,
                  )?.Nombre ?? contratoTransformado.contratista.tipo_persona_id);
          }
        }

        // Agregar contratista
        const numeroDocumento =
          contratoRaw.contratista?.numero_documento ?? 'Desconocido';

        if (numeroDocumento !== 'Desconocido') {
          const contratistaNombre =
            await this.consultarProveedor(numeroDocumento);
          contratoTransformado.contratista.nombre = contratistaNombre;
        }

        return contratoTransformado;
      }),
    );

    return contratosNormales;
  }

  private async transformarContratosConIdSeparados(
    contratos: any[],
    cacheParametros: Map<number, Map<number, ParametroBase>>,
  ): Promise<any[]> {
    const contratosNormales = await Promise.all(
      contratos.map(async (contratoRaw) => {
        const contratoTransformado: any = {
          id: contratoRaw.id,
        };

        Object.entries(this.parameterMap).forEach(([key, tipoParametroId]) => {
          if (contratoRaw[key] != null) {
            const parametrosMap = cacheParametros.get(tipoParametroId);
            if (parametrosMap && parametrosMap.has(contratoRaw[key])) {
              contratoTransformado[key] = contratoRaw[key];
              contratoTransformado[key.replace('_id', '')] = parametrosMap.get(
                contratoRaw[key],
              )?.Nombre;
            }
          }
        });

        ['vigencia', 'fecha_creacion', 'fecha_modificacion'].forEach(
          (campo) => {
            if (contratoRaw[campo] !== undefined) {
              contratoTransformado[campo] = contratoRaw[campo];
            }
          },
        );

        if (contratoRaw.estados) {
          contratoTransformado.estados = {
            id: contratoRaw.estados.id,
            contrato_general_id: contratoRaw.estados.contrato_general_id,
            usuario_id: contratoRaw.estados.usuario_id,
            usuario_rol: contratoRaw.estados.usuario_rol,
          };

          const estadoParametroMap = cacheParametros.get(
            this.parameterMap.estado_contrato_id,
          );
          if (
            estadoParametroMap &&
            contratoRaw.estados.estado_parametro_id != null
          ) {
            contratoTransformado.estados.estado_parametro_id =
              contratoRaw.estados.estado_parametro_id;
            contratoTransformado.estados.estado_parametro =
              estadoParametroMap.get(contratoRaw.estados.estado_parametro_id)
                ?.Nombre ?? contratoRaw.estados.estado_parametro_id;
          }

          [
            'estado_interno_parametro_id',
            'motivo',
            'actual',
            'fecha_evento',
            'activo',
            'fecha_creacion',
            'fecha_modificacion',
          ].forEach((campo) => {
            if (contratoRaw.estados[campo] !== undefined) {
              contratoTransformado.estados[campo] = contratoRaw.estados[campo];
            }
          });
        }

        if (contratoRaw.contratista) {
          contratoTransformado.contratista = {
            id: contratoRaw.contratista.id,
            numero_documento: contratoRaw.contratista.numero_documento,
          };

          const tipoPersonaMap = cacheParametros.get(
            this.parameterMap.tipo_persona_id,
          );
          if (
            tipoPersonaMap &&
            contratoRaw.contratista.tipo_persona_id != null
          ) {
            contratoTransformado.contratista.tipo_persona_id =
              contratoRaw.contratista.tipo_persona_id;
            contratoTransformado.contratista.tipo_persona =
              tipoPersonaMap.get(contratoRaw.contratista.tipo_persona_id)
                ?.Nombre ?? contratoRaw.contratista.tipo_persona_id;
          }

          if (contratoRaw.contratista.clase_contratista_id) {
            const claseContratistaMap = cacheParametros.get(
              this.parameterMap.clase_proveedor_id,
            );
            if (claseContratistaMap) {
              contratoTransformado.contratista.clase_contratista_id =
                contratoRaw.contratista.clase_contratista_id;
              contratoTransformado.contratista.clase_contratista =
                claseContratistaMap.get(
                  contratoRaw.contratista.clase_contratista_id,
                )?.Nombre ?? contratoRaw.contratista.clase_contratista_id;
            }
          }

          [
            'activo',
            'fecha_creacion',
            'fecha_modificacion',
            'contrato_general_id',
          ].forEach((campo) => {
            if (contratoRaw.contratista[campo] !== undefined) {
              contratoTransformado.contratista[campo] =
                contratoRaw.contratista[campo];
            }
          });

          const numeroDocumento =
            contratoRaw.contratista.numero_documento ?? 'Desconocido';
          if (numeroDocumento !== 'Desconocido') {
            contratoTransformado.contratista.nombre =
              await this.consultarProveedor(numeroDocumento);
          } else {
            contratoTransformado.contratista.nombre = null;
          }
        }

        return contratoTransformado;
      }),
    );

    return contratosNormales;
  }

  async getAllWithIds(
    queryParams: BaseQueryParamsDto,
  ): Promise<PaginatedResponse<any>> {
    try {
      const baseUrl = 'contratos-generales';
      const fields = 'vigencia,tipo_contrato_id,contratista,estados';
      const include = 'estados,contratista';
      const queryBase = { 'estados.actual': true };
      const queryFilter = queryParams.queryFilter
        ? JSON.parse(`{${queryParams.queryFilter}}`)
        : {};

      const query = { ...queryBase, ...queryFilter };

      const params = {
        fields,
        query: JSON.stringify(query),
        include,
        limit: queryParams.limit ?? 10,
        offset: queryParams.offset ?? 0,
      };

      const url = `${baseUrl}?${Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&')}`;

      this.logger.log(`Consultando contratos generales en ${url}`);

      const response = await fetchWithRetry(() =>
        this.gestionContractualCrud.get<PaginatedResponse<any>>(baseUrl, {
          params,
        }),
      );

      if (!response.data?.Data) {
        this.logger.warn('Respuesta inválida al consultar contratos generales');
        throw new NotFoundException('Contratos generales no encontrados');
      }

      const cacheParametros = await this.cargarCacheParametros();

      const BATCH_SIZE = 25;
      const batches = chunk(response.data.Data, BATCH_SIZE);

      const results = await Promise.all(
        batches.map((batch) =>
          this.transformarContratosConIdSeparados(batch, cacheParametros),
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
    } catch (error: any) {
      this.logger.error('Error en getAll:', error);
      throw new InternalServerErrorException(
        `Error al consultar contratos generales: ${error.message}`,
      );
    }
  }

  async getAll(
    queryParams: BaseQueryParamsDto,
  ): Promise<PaginatedResponse<any>> {
    try {
      const baseUrl = 'contratos-generales';
      const fields = 'vigencia,tipo_contrato_id,contratista,estados';
      const include = 'estados,contratista';
      const queryBase = { 'estados.actual': true };
      const queryFilter = queryParams.queryFilter
        ? JSON.parse(`{${queryParams.queryFilter}}`)
        : {};

      const query = { ...queryBase, ...queryFilter };

      const params = {
        fields,
        query: JSON.stringify(query),
        include,
        limit: queryParams.limit ?? 10,
        offset: queryParams.offset ?? 0,
      };

      const url = `${baseUrl}?${Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&')}`;

      this.logger.log(`Consultando contratos generales en ${url}`);

      const response = await fetchWithRetry(() =>
        this.gestionContractualCrud.get<PaginatedResponse<any>>(baseUrl, {
          params,
        }),
      );

      if (!response.data?.Data) {
        this.logger.warn('Respuesta inválida al consultar contratos generales');
        throw new NotFoundException('Contratos generales no encontrados');
      }

      const cacheParametros = await this.cargarCacheParametros();

      const BATCH_SIZE = 25;
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
    } catch (error: any) {
      this.logger.error('Error en getAll:', error);
      throw new InternalServerErrorException(
        `Error al consultar contratos generales: ${error.message}`,
      );
    }
  }

  async getContratoTransformed(id: number, ids: boolean = false): Promise<any> {
    this.logger.log(`Consultando contrato transformado para ID ${id}`);
    try {
      const contratoRaw = await this.consultarInfoContrato(id);
      const cacheParametros = await this.cargarCacheParametros();
      const [contratoTransformado] = await this.transformarContratos(
        [contratoRaw],
        cacheParametros,
        ids,
      );
      return this.aFormaConsumidores(contratoTransformado);
    } catch (error) {
      this.logger.error(
        `Error en getContratoTransformed para ID ${id}:`,
        error,
      );
      throw error;
    }
  }

  // Forma del contrato que usan el MF y minuta_contractual_mid: renombra
  // fecha_suscripcion_estudio y origen_presupuesto(_id) y deja las fechas sin hora.
  private aFormaConsumidores(contrato: any): any {
    const {
      fecha_suscripcion_estudio,
      origen_presupuesto_id,
      origen_presupuesto,
      ...resto
    } = contrato;
    const soloFecha = (fecha?: string | null) => fecha?.slice(0, 10) ?? fecha;

    return {
      ...resto,
      fecha_inicial: soloFecha(contrato.fecha_inicial),
      fecha_final: soloFecha(contrato.fecha_final),
      fecha_suscripcion: soloFecha(contrato.fecha_suscripcion),
      fecha_suscripcion_estudios: soloFecha(fecha_suscripcion_estudio),
      origen_presupuestos_id: origen_presupuesto_id,
      origen_presupuestos: origen_presupuesto,
    };
  }

  private async consultarProveedor(id: number): Promise<string | null> {
    try {
      const endpoint: string = this.configService.get<string>(
        'PROVEEDORES_MID_SERVICE',
      );
      if (!endpoint) {
        this.logger.error('No se ha configurado el endpoint de proveedores');
        throw new Error('No se ha configurado el endpoint de proveedores');
      }
      const url = `${endpoint}contratistas?id=${id}`;
      const { data } = await axios.get<ContratoResponse>(url);
      return data.Data.proveedor.nombre_completo_proveedor;
    } catch (error) {
      console.error('Error en consultarProveedor:', error);
      return null;
    }
  }

  // Información de contratos generales por unidad y vigencia
  async obtenerConteo(body: any, endpoint: string): Promise<any> {
    try {
      const urlGestionContractualCrud: string = this.configService.get<string>(
        'GESTION_CONTRACTUAL_CRUD_SERVICE',
      );

      const base = urlGestionContractualCrud.replace(/\/$/, '');
      const url = `${base}/${RECURSOS_CRUD.contratoGeneral}/${endpoint}`;
      const { data } = await axios.post<any>(url, body);

      // El CRUD responde Status como número en los éxitos y como texto en los errores.
      if (!data.Success || Number(data.Status) !== 200) {
        return null;
      }

      return data.Data;
    } catch (error) {
      return null;
    }
  }

  // Los dos conteos del CRUD exigen vigencia_id, el Id del parámetro de vigencia.
  private leerVigenciaId(body: any): number {
    const vigenciaId = Number(body?.vigencia_id);
    if (!Number.isInteger(vigenciaId) || vigenciaId <= 0) {
      throw new BadRequestException({
        Success: false,
        Status: HttpStatus.BAD_REQUEST,
        Message: 'El campo vigencia_id es requerido y debe ser un entero',
        Data: null,
      });
    }
    return vigenciaId;
  }

  async generarConsecutivo(body: any) {
    const vigenciaId = this.leerVigenciaId(body);

    try {
      const { unidad_ejecutora_id } = body;
      if (!unidad_ejecutora_id) {
        throw new Error(`El campo unidad_ejecutora_id es requerido`);
      }

      let conteo = await this.obtenerConteo(
        {
          unidad_ejecutora_id: Number(unidad_ejecutora_id),
          vigencia_id: vigenciaId,
        },
        'conteo-consecutivo',
      );
      if (!Number.isInteger(conteo) || conteo < 0) {
        throw new Error('Error al obtener el conteo de los contratos');
      }

      const numeroContrato = conteo + 1;
      return numeroContrato.toString();
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Error al generar consecutivo del contrato: ${error.message}`,
      );
    }
  }

  async generarNumeroContrato(body: any) {
    const vigenciaId = this.leerVigenciaId(body);

    try {
      const { unidad_ejecutora_id, estado } = body;
      if (!unidad_ejecutora_id) {
        throw new Error(`El campo unidad_ejecutora_id es requerido`);
      }
      if (!estado) {
        throw new Error('El campo estado es requerido');
      }

      const { prefijo, sufijo } = datos[unidad_ejecutora_id];
      if (prefijo == null || sufijo == null) {
        throw new Error('Unidad ejecutora invalida');
      }

      const conteo = await this.contarNumeros(
        Number(unidad_ejecutora_id),
        vigenciaId,
        Number(estado),
      );
      return prefijo + (conteo + 1) + sufijo;
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Error al generar número de contrato: ${error.message}`,
      );
    }
  }

  // Contratos de la unidad y la vigencia que tienen o tuvieron el estado.
  private async contarNumeros(
    unidadEjecutoraId: number,
    vigenciaId: number,
    estado: number,
  ): Promise<number> {
    const conteo = await this.obtenerConteo(
      { unidad_ejecutora_id: unidadEjecutoraId, vigencia_id: vigenciaId, estado },
      'conteo-numero-contrato',
    );
    if (!Number.isInteger(conteo) || conteo < 0) {
      throw new Error('Error al obtener el conteo de los contratos');
    }
    return conteo;
  }

  // Registra un estado del contrato. Al pasar a SUSCRITO, si el contrato no tiene
  // número, lo calcula y lo guarda antes del estado: un reintento tras una falla
  // a mitad encuentra el número y no genera otro.
  async registrarEstado(id: number, cambio: RegistrarEstadoContratoDto) {
    const contrato = await this.leerContratoCrud(id);
    let numeroContrato: string | null = contrato.numero_contrato || null;

    if (
      cambio.estado_parametro_id === environment.ESTADOS_GENERALES.SUSCRITO &&
      !numeroContrato
    ) {
      numeroContrato = await this.asignarNumero(contrato);
    }

    const { data } = await this.escribirCrud(() =>
      this.gestionContractualCrud.post(`${RECURSOS_CRUD.estadoContrato}/`, {
        ...cambio,
        contrato_general_id: { id },
      }),
    );
    return { estado: data?.Data ?? null, numero_contrato: numeroContrato };
  }

  private async leerContratoCrud(id: number): Promise<any> {
    const { data } = await this.escribirCrud(() =>
      this.gestionContractualCrud.get(`${RECURSOS_CRUD.contratoGeneral}/${id}`),
    );
    if (!data?.Data) {
      throw new NotFoundException(`No se encontró el contrato con id ${id}`);
    }
    return data.Data;
  }

  // Si el número choca con otro (409 de la restricción única), recalcula y
  // reintenta una sola vez con el siguiente disponible.
  private async asignarNumero(contrato: any): Promise<string> {
    const unidad = Number(contrato.unidad_ejecutora_id);
    const vigenciaId = Number(contrato.vigencia_id);
    if (!Number.isInteger(vigenciaId) || vigenciaId <= 0) {
      throw this.solicitudInvalida(
        'El contrato no tiene vigencia_id: no se puede asignar el número de contrato',
      );
    }
    const formato = datos[unidad];
    if (!formato) {
      throw this.solicitudInvalida(
        `La unidad ejecutora ${unidad} no tiene prefijo de número de contrato`,
      );
    }

    const suscrito = environment.ESTADOS_GENERALES.SUSCRITO;
    let consecutivo =
      (await this.contarNumeros(unidad, vigenciaId, suscrito)) + 1;
    for (let intento = 0; ; intento++) {
      const numero = `${formato.prefijo}${consecutivo}${formato.sufijo}`;
      try {
        await this.escribirCrud(() =>
          this.gestionContractualCrud.put(
            `${RECURSOS_CRUD.contratoGeneral}/${contrato.id}`,
            { numero_contrato: numero },
          ),
        );
        return numero;
      } catch (error) {
        const choque =
          error instanceof HttpException && error.getStatus() === HttpStatus.CONFLICT;
        if (!choque || intento > 0) throw error;
        const recontado =
          (await this.contarNumeros(unidad, vigenciaId, suscrito)) + 1;
        consecutivo = Math.max(recontado, consecutivo + 1);
      }
    }
  }

  private solicitudInvalida(mensaje: string): BadRequestException {
    return new BadRequestException({
      Success: false,
      Status: HttpStatus.BAD_REQUEST,
      Message: mensaje,
      Data: null,
    });
  }

  // Los errores HTTP del CRUD se propagan con su status y su cuerpo.
  private async escribirCrud<T>(peticion: () => Promise<T>): Promise<T> {
    try {
      return await peticion();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new HttpException(error.response.data, error.response.status);
      }
      throw error;
    }
  }
}
