import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { createAxiosInstance, fetchWithRetry } from 'src/utils/axios-utils';
import {
  aCuerpoBeego,
  aFormaAnterior,
  aQueryBeego,
} from '../utils/query-beego.utils';

export interface RespuestaCrud {
  status: number;
  body: any;
}

// Intermediario entre el MF y gestion_contractual_crud para pólizas y amparos
// (#360). Traduce filtro, cuerpo y respuesta al CRUD Beego v2 (#397), para que
// el MF y minuta_contractual_mid conserven el contrato que tenían con el CRUD.
@Injectable()
export class PolizasService {
  private readonly logger = new Logger(PolizasService.name);
  private readonly gestionContractualCrud: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.gestionContractualCrud = createAxiosInstance(
      this.configService,
      'GESTION_CONTRACTUAL_CRUD_SERVICE'
    )
  }

  consultar(ruta: string, params: Record<string, any>): Promise<RespuestaCrud> {
    const { query, sortBy, orderBy, limit, offset } = params;
    return this.reenviar(
      {
        method: 'GET',
        url: ruta,
        params: {
          ...aQueryBeego(this.leerFiltro(query), { sortBy, orderBy }),
          limit,
          offset,
        },
      },
      true,
    );
  }

  crear(ruta: string, body: any): Promise<RespuestaCrud> {
    return this.reenviar({
      method: 'POST',
      url: ruta,
      data: aCuerpoBeego(body),
    });
  }

  actualizar(ruta: string, id: number, body: any): Promise<RespuestaCrud> {
    return this.reenviar({
      method: 'PUT',
      url: `${ruta}/${id}`,
      data: aCuerpoBeego(body),
    });
  }

  eliminar(ruta: string, id: number): Promise<RespuestaCrud> {
    return this.reenviar({ method: 'DELETE', url: `${ruta}/${id}` });
  }

  private leerFiltro(query?: string): Record<string, unknown> {
    if (!query) return {};
    try {
      return JSON.parse(query);
    } catch {
      throw new HttpException(
        {
          Success: false,
          Status: HttpStatus.BAD_REQUEST,
          Message: 'El filtro query debe ser un JSON válido',
          Data: null,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // El CRUD Beego v2 responde Status como texto; el MF lo espera como número.
  private aRespuestaAnterior(cuerpo: any): any {
    const { Data, Status } = cuerpo;
    return {
      ...cuerpo,
      ...(Status !== undefined && { Status: Number(Status) }),
      Data: Array.isArray(Data)
        ? Data.map(aFormaAnterior)
        : Data && typeof Data === 'object'
          ? aFormaAnterior(Data)
          : Data,
    };
  }

  // Solo los GET se reintentan: repetir un POST/PUT/DELETE podría duplicar
  // escrituras en el CRUD.
  private async reenviar(
    config: AxiosRequestConfig,
    reintentar = false,
  ): Promise<RespuestaCrud> {
    try {
      const response = reintentar
        ? await fetchWithRetry(() =>
            this.gestionContractualCrud.request(config),
          )
        : await this.gestionContractualCrud.request(config);

      return {
        status: response.status,
        body: this.aRespuestaAnterior(response.data),
      };
    } catch (error) {
      // Error HTTP del CRUD (400, 404, 500...): se propaga tal cual.
      if (axios.isAxiosError(error) && error.response) {
        throw new HttpException(error.response.data, error.response.status);
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error al consultar gestion_contractual_crud (${config.method} ${config.url}): ${message}`,
      );

      throw new HttpException(
        {
          Success: false,
          Status: HttpStatus.INTERNAL_SERVER_ERROR,
          Message: 'Error al comunicarse con gestion_contractual_crud',
          Data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

}
