import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AxiosError, AxiosHeaders } from 'axios';
import { firstValueFrom, of, throwError } from 'rxjs';
import { EspaciosFisicosService } from './espacios-fisicos.service';

const OIKOS = 'http://oikos.test/v1/';
const SEDES = [
  { Id: 10, Nombre: 'Sede Calle 40' },
  { Id: 11, Nombre: 'Sede Macarena' },
];
const asignacion = (espacioId: number) => ({
  Id: espacioId * 100,
  DependenciaId: { Id: 20, Nombre: 'Facultad de Ingeniería' },
  EspacioFisicoId: { Id: espacioId },
});
const errorAxios = (status: number) =>
  new AxiosError('Oikos falló', String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: {},
  });

describe('EspaciosFisicosService.obtenerDependenciaPorId', () => {
  let service: EspaciosFisicosService;
  let http: { get: jest.Mock };

  // La primera llamada son las asignaciones de la dependencia y la segunda las sedes.
  const responder = (asignaciones: unknown, sedes: unknown = { data: SEDES }) =>
    http.get.mockImplementation((url: string) => {
      const respuesta = url.includes('asignacion_espacio_fisico_dependencia')
        ? asignaciones
        : sedes;
      return respuesta instanceof Error
        ? throwError(() => respuesta)
        : of(respuesta);
    });

  beforeEach(async () => {
    http = { get: jest.fn() };
    const modulo = await Test.createTestingModule({
      providers: [
        EspaciosFisicosService,
        { provide: HttpService, useValue: http },
        {
          provide: ConfigService,
          useValue: {
            get: (llave: string) =>
              llave === 'oikos.espaciosFisicosEndpoint' ? OIKOS : 38,
          },
        },
      ],
    }).compile();
    service = modulo.get(EspaciosFisicosService);
  });

  it('dependencia con una sede: nombre y la sede', async () => {
    responder({ data: [asignacion(10)] });
    await expect(
      firstValueFrom(service.obtenerDependenciaPorId('20')),
    ).resolves.toEqual({
      id: 20,
      nombre: 'Facultad de Ingeniería',
      sedes: [{ id: 10, nombre: 'Sede Calle 40' }],
    });
    const [urlAsignaciones] = http.get.mock.calls.map(([url]) =>
      decodeURIComponent(url),
    );
    expect(urlAsignaciones).toContain('query=DependenciaId:20,Activo:true');
    expect(urlAsignaciones).toContain('limit=0');
  });

  it('dependencia con varias sedes: todas, ordenadas por nombre, sin espacios que no son sede', async () => {
    responder({ data: [asignacion(11), asignacion(10), asignacion(999)] });
    const dependencia = await firstValueFrom(
      service.obtenerDependenciaPorId('20'),
    );
    expect(dependencia.sedes).toEqual([
      { id: 10, nombre: 'Sede Calle 40' },
      { id: 11, nombre: 'Sede Macarena' },
    ]);
  });

  it('dependencia inexistente ([{}] de Oikos): 404', async () => {
    responder({ data: [{}] });
    await expect(
      firstValueFrom(service.obtenerDependenciaPorId('77')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sin sedes activas (404 de Oikos en sedes): la dependencia sale sin sedes', async () => {
    responder({ data: [asignacion(10)] }, errorAxios(404));
    const dependencia = await firstValueFrom(
      service.obtenerDependenciaPorId('20'),
    );
    expect(dependencia.sedes).toEqual([]);
  });

  it('Oikos caído: error claro', async () => {
    responder(errorAxios(503));
    const error = await firstValueFrom(
      service.obtenerDependenciaPorId('20'),
    ).catch((e) => e);
    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect(error.message).toContain('Error en la comunicación con el servicio');
  });
});
