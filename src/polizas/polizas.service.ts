import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { createAxiosInstance, fetchWithRetry } from 'src/utils/axios-utils';
import {
  aCuerpoCrud,
  aFormaConsumidores,
  aQueryCrud,
} from '../utils/query-crud.utils';

export interface RespuestaCrud {
  status: number;
  body: any;
}

// Intermediario entre el MF y gestion_contractual_crud para pólizas y amparos
// (#360). Traduce filtro, cuerpo y respuesta entre la forma que usan el MF y
// minuta_contractual_mid y la del CRUD.
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
          ...aQueryCrud(this.leerFiltro(query), { sortBy, orderBy }),
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
      data: aCuerpoCrud(body),
    });
  }

  // El CRUD registra de a uno. Responde Status 201 con los creados, o Status 206
  // con { creados, errores } si falla una parte.
  async crearAmparos(ruta: string, amparos: any): Promise<RespuestaCrud> {
    if (!Array.isArray(amparos)) {
      throw new HttpException(
        {
          Success: false,
          Status: HttpStatus.BAD_REQUEST,
          Message: 'El cuerpo debe ser un arreglo de amparos',
          Data: null,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const creados: unknown[] = [];
    const errores: { amparo: unknown; error: string }[] = [];
    for (const amparo of amparos) {
      try {
        const { body } = await this.crear(ruta, amparo);
        creados.push(body.Data);
      } catch (error) {
        errores.push({ amparo, error: this.mensajeDeError(error) });
      }
    }

    if (errores.length > 0) {
      return {
        status: HttpStatus.PARTIAL_CONTENT,
        body: {
          Success: true,
          Status: HttpStatus.PARTIAL_CONTENT,
          Message: 'Algunos amparos no pudieron ser creados',
          Data: { creados, errores },
        },
      };
    }

    return {
      status: HttpStatus.CREATED,
      body: {
        Success: true,
        Status: HttpStatus.CREATED,
        Message: 'Amparos creados',
        Data: creados,
        Metadata: { total: creados.length },
      },
    };
  }

  private mensajeDeError(error: unknown): string {
    const respuesta = error instanceof HttpException ? error.getResponse() : null;
    return (respuesta as any)?.Message ?? (error as Error)?.message ?? String(error);
  }

  actualizar(ruta: string, id: number, body: any): Promise<RespuestaCrud> {
    return this.reenviar({
      method: 'PUT',
      url: `${ruta}/${id}`,
      data: aCuerpoCrud(body),
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

  // El MF espera Status como número.
  private aRespuestaConsumidores(cuerpo: any): any {
    const { Data, Status } = cuerpo;
    return {
      ...cuerpo,
      ...(Status !== undefined && { Status: Number(Status) }),
      Data: Array.isArray(Data)
        ? Data.map(aFormaConsumidores)
        : Data && typeof Data === 'object'
          ? aFormaConsumidores(Data)
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
        body: this.aRespuestaConsumidores(response.data),
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
