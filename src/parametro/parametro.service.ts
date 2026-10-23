import { Inject, Injectable } from '@nestjs/common';
import { Observable, from, of, map, catchError } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { ParametroBase, StandardResponse } from 'src/interfaces/responses.interface';

@Injectable()
export class ParametroService {
  private readonly axiosInstance: AxiosInstance;

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {
    this.axiosInstance = axios.create({
      baseURL: this.configService.get<string>('ENDP_PARAMETROS_CRUD'),
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

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

  getParametro(
    tipoParametroId: number,
    valorId: number,
  ): Observable<string | null> {
    return from(
      this.axiosInstance.get('', {
        params: {
          query: `TipoParametroId:${tipoParametroId}`,
          limit: 0,
        },
      }),
    ).pipe(
      map((response) => {
        const parametro = response.data.Data.find(
          (item) => item.Id === valorId,
        );
        return parametro ? parametro.Nombre : null;
      }),
      catchError((error) => {
        console.error('Error fetching parametro:', error.message);
        return of(null);
      }),
    );
  }

  async getParametrosPorTipoId(
    ids: string[],
  ): Promise<Record<string, ParametroBase[]>> {
    const parametros: Record<string, ParametroBase[]> = {};
    const noEncontrados: string[] = [];

    for (const id of ids) {
      const parametrosPorTipo =
        await this.cacheManager.get<Record<string, ParametroBase>>(id);
      if (parametrosPorTipo) {
        parametros[id] = Object.values(parametrosPorTipo);
      } else {
        noEncontrados.push(id);
      }
    }

    if (noEncontrados.length === 0) {
      return parametros;
    }

    await Promise.all(
      noEncontrados.map(async (id) => {
        const res = await this.fetchWithRetry(() =>
          this.axiosInstance.get<StandardResponse<ParametroBase[]>>(
            'parametro',
            {
              params: {
                query: `TipoParametroId.Id:${id}`, //,Activo:true
                fields: 'Id,Nombre,Descripcion,CodigoAbreviacion,Activo',
                limit: 0,
              },
            },
          ),
        );

        if (res.data?.Success === false || !Array.isArray(res.data?.Data)) {
          throw new Error(
            `Respuesta inválida del servidor de parámetros para el tipo ${id}`,
          );
        }

        // parametros_crud responde [{}] cuando el tipo no tiene registros
        const listaParametros = res.data.Data.filter(
          (parametro) => parametro?.Id != null,
        );
        parametros[id] = listaParametros;

        if (listaParametros.length === 0) {
          return;
        }

        const parametrosPorTipo: Record<string, ParametroBase> = {};
        for (const parametro of listaParametros) {
          parametrosPorTipo[parametro.Id.toString()] = parametro;
        }
        await this.cacheManager.set(id, parametrosPorTipo);
      }),
    );

    return parametros;
  }

  async getParametrosIndexados(ids: string[]) {
    const indexados = new Map<number, Map<number, ParametroBase>>();
    const parametros = await this.getParametrosPorTipoId(ids);

    for (const [tipoId, listaParametros] of Object.entries(parametros)) {
      const mapaInterno = new Map<number, ParametroBase>();
      for (const parametro of listaParametros) {
        mapaInterno.set(parametro.Id, parametro);
      }

      indexados.set(Number(tipoId), mapaInterno);
    }
    return indexados;
  }

  limpiarCache() {
    this.cacheManager.clear();
  }
}
