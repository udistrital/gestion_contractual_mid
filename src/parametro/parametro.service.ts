import { Injectable } from '@nestjs/common';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import {ConfigService} from "@nestjs/config";
import axios, {AxiosInstance} from "axios";

@Injectable()
export class ParametroService {

    private readonly axiosInstance: AxiosInstance;

    constructor(
        private configService: ConfigService,
    ) {
        this.axiosInstance = axios.create({
            baseURL: this.configService.get<string>('ENDP_PARAMETROS_CRUD'),
            timeout: 1000, // 1 segundo de timeout
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    getParametro(tipoParametroId: number, valorId: number): Observable<string | null> {
        return from(this.axiosInstance.get('', {
            params: {
                query: `TipoParametroId:${tipoParametroId}`,
                limit: 0
            }
        })).pipe(
            map(response => {
                const parametro = response.data.Data.find(item => item.Id === valorId);
                return parametro ? parametro.Nombre : null;
            }),
            catchError(error => {
                console.error('Error fetching parametro:', error.message);
                return of(null);
            })
        );
    }
}