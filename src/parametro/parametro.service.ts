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
      timeout: 1000, // 1 segundo de timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });
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
        const res =
          await this.axiosInstance.get<StandardResponse<ParametroBase[]>>(
            'parametro',
            {
              params: {
                query: `TipoParametroId.Id:${id}`, //,Activo:true
                fields: 'Id,Nombre,Descripcion,CodigoAbreviacion,Activo',
                limit: 0,
              },
            },
          );

        const listaParametros = res.data.Data ?? [];
        const parametrosPorTipo: Record<string, ParametroBase> = {};
        for (const parametro of listaParametros) {
          parametrosPorTipo[parametro.Id.toString()] = parametro;
        }

        parametros[id] = listaParametros;
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
