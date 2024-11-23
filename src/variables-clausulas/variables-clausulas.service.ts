import {HttpStatus, Injectable} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { CDPResponse, LugarEjecucionResponse, ProveedorResponse, StandardResponse } from 'src/interfaces/responses.interface';

interface ContratoResponse {
  Status: string;
  Data: any;
}

interface ParametroResponse {
  Status: string;
  Data: Array<{
    Id: number;
    Nombre: string;
  }>;
}

interface variablesResponse {
  objeto?: any; ///
  actividades?: any; ///
  valorPesos?: any;
  valorTexto?: any;
  numero_cdp_id?: any;
  vigencia_cdp?: any;
  rubro_cdp?: any; ///
  plazoEjecucion?: any;
  unidadEjecutoraId?: any;
  supervisor?: any; ///
  ciudad_id?: any;
  especificaciones?: any; ///
  modoPago?: any;
  nom_arrendador?: any; ///
  nit_arrendador?: any; ///
  dir_arrendador?: any; ///
  nombre_completo_proveedor?: any;
  numero_documento?: any; 
  ordenadorId?: any;
  cargo_ordenador?: any; ///
  sede_id?: any;
  telefono_oficina?: any; ///
  correo_ordenador?: any; ///
  representante?: any; ///
  direccion?: any;
  telefono_contratista?: any; ///
  correo?: any;
  oficina_supervisora?: any; ///
}

@Injectable()
export class VariablesClausulasService {
  private readonly parametrosAxiosInstance: AxiosInstance;
  
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

  private readonly parameterMap = {
    ordenadorId: 1, ///
    plazoEjecucion: 180,
    unidadEjecutoraId: 7,
    ciudad_id: 101, ///
    sede_id: 301, ///
  } as const;

  constructor(
    private configService: ConfigService,
  ) {
    const parametrosEndpoint = this.configService.get<string>('ENDP_PARAMETROS');
    this.parametrosAxiosInstance = axios.create({
      baseURL: parametrosEndpoint,
    });
  }

  private async obtenerParametrosPorTipo(tipoParametroId: number): Promise<Map<number, string>> {
    try {
      const { data } = await this.parametrosAxiosInstance.get<ParametroResponse>(`parametro?query=TipoParametroId:${tipoParametroId}&limit=0`);

      if (data.Status !== '200' || !data.Data) {
        throw new Error('Respuesta inválida del servidor de parámetros');
      }

      return new Map(
        data.Data.map((param) => [param.Id, param.Nombre])
      );
    } catch (error) {
      console.error(`Error al obtener parámetros tipo ${tipoParametroId}: ${error.message}`);
      throw error;
    }
  }

  private async cargarCacheParametros(): Promise<Map<number, Map<number, string>>> {
    const tiposParametros = new Set(Object.values(this.parameterMap));
    const cacheParametros = new Map<number, Map<number, string>>();

    await Promise.all(
      Array.from(tiposParametros).map(async (tipoParametroId) => {
        const parametros = await this.obtenerParametrosPorTipo(tipoParametroId);
        cacheParametros.set(tipoParametroId, parametros);
      })
    );

    return cacheParametros;
  }

  private async transformarVariables(
    variables: variablesResponse,
    cacheParametros: Map<number, Map<number, string>>
  ): Promise<variablesResponse> {
    const variablesTransformadas = { ...variables };

    Object.entries(this.parameterMap).forEach(([key, tipoParametroId]) => {
      if (variables[key] != null) {
        const parametrosMap = cacheParametros.get(tipoParametroId);
        if (parametrosMap && parametrosMap.has(variables[key])) {
          variablesTransformadas[key] = parametrosMap.get(variables[key]);
        }
      }
    });

    return variablesTransformadas;
  }

  async dataVaribles(id: string): Promise<StandardResponse<variablesResponse>> {
    try {
      const endpoint: string = this.configService.get<string>('ENDP_GESTION_CONTRACTUAL_CRUD');
      const url = `${endpoint}contratos-generales/${id}`;
      const { data } = await axios.get<ContratoResponse>(url);

      if (data.Data == undefined) {
        return {
          Success: false,
          Status: HttpStatus.NOT_FOUND,
          Message: 'Contrato no encontrado',
        };
      }

      const infoContrato = data.Data;
      const cdpInfo = await this.obetenerCDP(id);
      const proveedorInfo = await this.obetenerProveedor(id);
      const lugarEjecucionInfo = await this.obetenerLugarEjecucion(id);

      let filteredResponse: variablesResponse = {
        // objeto:
        // actividades:
        valorPesos: infoContrato.valorPesos,
        valorTexto: this.numeroATexto(infoContrato.valorPesos),
        numero_cdp_id: cdpInfo?.numero_cdp_id,
        vigencia_cdp: cdpInfo?.vigencia_cdp,
        // rubro_cdp:
        plazoEjecucion: infoContrato.plazoEjecucion,
        unidadEjecutoraId: infoContrato.unidadEjecutoraId,
        // supervisor:
        ciudad_id: lugarEjecucionInfo?.ciudad_id,
        // especificaciones:
        modoPago: infoContrato.modoPago,
        // nom_arrendador:
        // nit_arrendador:
        // dir_arrendador:
        nombre_completo_proveedor: proveedorInfo?.proveedor?.nombre_completo_proveedor,
        numero_documento: proveedorInfo?.proveedor?.numero_documento,
        ordenadorId: infoContrato.ordenadorId,
        // cargo_ordenador:
        sede_id: lugarEjecucionInfo?.sede_id,
        // telefono_oficina:
        // correo_ordenador:
        // representante:
        direccion: proveedorInfo?.proveedor?.direccion,
        // telefono_contratista:
        correo: proveedorInfo?.proveedor?.correo
        // oficina_supervisora:
      };

      // Transformar los parámetros
      /*const cacheParametros = await this.cargarCacheParametros();
      filteredResponse = await this.transformarVariables(filteredResponse, cacheParametros);
*/
      return {
        Success: true,
        Status: HttpStatus.OK,
        Message: 'Variables de contrato encontradas',
        Data: filteredResponse,
      };
    } catch (error) {
      return {
        Success: false,
        Status: error.response?.status || 500,
        Message: error.message || 'Error al consultar el contrato',
      };
    }
  }

  async obetenerCDP(id: string): Promise<CDPResponse> {
    try {
      const endpoint: string = this.configService.get<string>('ENDP_GESTION_CONTRACTUAL_CRUD');
      const url = `${endpoint}cdp/contrato/${id}`;
      const { data } = await axios.get<ContratoResponse>(url);
      return data.Data[0];
    } catch (error) {
      return null;
    }
  }

  async obetenerLugarEjecucion(id: string): Promise<LugarEjecucionResponse<any>> {
    try {
      const endpoint: string = this.configService.get<string>('ENDP_GESTION_CONTRACTUAL_CRUD');
      const url = `${endpoint}lugares-ejecucion/contrato/${id}`;
      const { data } = await axios.get<LugarEjecucionResponse<any>>(url);
      return data;
    } catch (error) {
      return null;
    }
  }

  async obetenerProveedor(id: string): Promise<ProveedorResponse> {
    try {
      const endpoint: string = this.configService.get<string>('ENDP_PROVEEDORES_MID');
      const url = `${endpoint}contratistas?id=${id}071172124`;
      const { data } = await axios.get<ContratoResponse>(url);
      return data.Data;
    } catch (error) {
      return null;
    }
  }
}