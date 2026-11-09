import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import request from 'supertest';
import nock from 'nock';
import { EspaciosFisicosModule } from './../src/espacios-fisicos/espacios-fisicos.module';
import { SupervisoresModule } from './../src/supervisor/supervisores.module';

// e2e sin red real: GET /espacios-fisicos/dependencias/{id} y GET /supervisores/contrato/{id}
// con Oikos, el CRUD Beego v2 y el MID de ordenadores y supervisores simulados con nock.
const OIKOS = 'http://oikos.test';
const CRUD = 'http://crud.test/v1';
const SUPERVISORES_MID = 'http://supervisores.test';
const SEDE_OIKOS = 38;

const asignacion = (
  espacioId: number,
  dependenciaId = 20,
  nombre = 'Facultad de Ingeniería',
) => ({
  Id: espacioId * 100,
  DependenciaId: { Id: dependenciaId, Nombre: nombre },
  EspacioFisicoId: { Id: espacioId },
});
const SEDES = [
  { Id: 10, Nombre: 'Sede Calle 40' },
  { Id: 11, Nombre: 'Sede Macarena' },
];

const oikosDependencia = (
  dependenciaId: number,
  asignaciones: unknown,
  status = 200,
) =>
  nock(OIKOS)
    .get('/asignacion_espacio_fisico_dependencia')
    .query({
      query: `DependenciaId:${dependenciaId},Activo:true`,
      fields: 'Id,DependenciaId,EspacioFisicoId',
      limit: '0',
    })
    .reply(status, asignaciones);
const oikosSedes = () =>
  nock(OIKOS)
    .get('/espacio_fisico')
    .query({
      query: `TipoEspacioFisicoId:${SEDE_OIKOS},Activo:true`,
      fields: 'Id,Nombre',
      limit: '0',
    })
    .reply(200, SEDES);

describe('Espacios físicos y supervisores (e2e con nock)', () => {
  let app: INestApplication;

  beforeAll(() => {
    process.env.OIKOS_ESPACIOS_FISICOS_SERVICE = `${OIKOS}/`;
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              GESTION_CONTRACTUAL_CRUD_SERVICE: `${CRUD}/`,
              ORDENADOR_SUPERVISOR_MID_SERVICE: `${SUPERVISORES_MID}/`,
              PARAMETROS_CRUD_SERVICE: 'http://parametros.test/v1/',
            }),
          ],
        }),
        CacheModule.register({ isGlobal: true }),
        EspaciosFisicosModule,
        SupervisoresModule,
      ],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    nock.cleanAll();
    await app.close();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  describe('GET /espacios-fisicos/dependencias/{id}', () => {
    it('200: dependencia con una sede', async () => {
      const oikos = [oikosDependencia(20, [asignacion(10)]), oikosSedes()];
      const res = await request(app.getHttpServer())
        .get('/espacios-fisicos/dependencias/20')
        .expect(200);
      expect(res.body).toEqual({
        Success: true,
        Status: 200,
        Message: 'Dependencia 20 obtenida exitosamente',
        Data: {
          id: 20,
          nombre: 'Facultad de Ingeniería',
          sedes: [{ id: 10, nombre: 'Sede Calle 40' }],
        },
      });
      oikos.forEach((n) => expect(n.isDone()).toBe(true));
    });

    it('200: dependencia con varias sedes, sin los espacios que no son sede', async () => {
      oikosDependencia(20, [asignacion(11), asignacion(10), asignacion(999)]);
      oikosSedes();
      const res = await request(app.getHttpServer())
        .get('/espacios-fisicos/dependencias/20')
        .expect(200);
      expect(res.body.Data.sedes).toEqual([
        { id: 10, nombre: 'Sede Calle 40' },
        { id: 11, nombre: 'Sede Macarena' },
      ]);
    });

    it('404: dependencia inexistente', async () => {
      oikosDependencia(77, [{}]);
      oikosSedes();
      const res = await request(app.getHttpServer())
        .get('/espacios-fisicos/dependencias/77')
        .expect(404);
      expect(res.body).toEqual(
        expect.objectContaining({
          Success: false,
          Status: 404,
          Message: 'No se encontró la dependencia con ID 77',
        }),
      );
    });

    it('500: Oikos caído, con el motivo', async () => {
      oikosDependencia(20, { message: 'caído' }, 503);
      oikosSedes();
      const res = await request(app.getHttpServer())
        .get('/espacios-fisicos/dependencias/20')
        .expect(500);
      expect(res.body.Success).toBe(false);
      expect(res.body.Message).toContain(
        'Error en la comunicación con el servicio',
      );
    });

    it('400: el id no es un número y no llama a Oikos', async () => {
      const oikos = oikosDependencia(20, [asignacion(10)]);
      await request(app.getHttpServer())
        .get('/espacios-fisicos/dependencias/abc')
        .expect(400);
      expect(oikos.isDone()).toBe(false);
    });
  });

  describe('GET /supervisores/contrato/{id}', () => {
    const supervisor = (extra: Record<string, unknown> = {}) => ({
      id: 61,
      documento: 1000000005,
      sede_legado: 'SEDE LEGADO',
      dependencia_legado: 'Facultad de Ingeniería',
      cargo_legado: 'Decano',
      digito_verificacion: 3,
      dependencia_id: 20,
      contrato_general_id: { id: 42 },
      ...extra,
    });
    const crudSupervisores = (datos: unknown[]) =>
      nock(CRUD)
        .get('/supervisores/')
        .query({
          query: 'contrato_general_id.id:42,activo:true',
          sortby: 'id',
          order: 'asc',
          limit: '0',
        })
        .reply(200, {
          Success: true,
          Status: '200',
          Message: 'ok',
          Data: datos,
        });
    const supervisoresMid = () =>
      nock(SUPERVISORES_MID)
        .get('/supervisores/documento')
        .query({ documento: '1000000005' })
        .reply(200, {
          Status: '200',
          Data: [
            {
              dependencia_supervisor: 'Facultad de Ingeniería',
              cargo: 'Decano',
              nombre: 'SUPERVISOR DE PRUEBA',
            },
          ],
        });

    it('usa la ruta del CRUD Beego y toma la sede de la dependencia si tiene una sola', async () => {
      const crud = crudSupervisores([supervisor()]);
      supervisoresMid();
      oikosDependencia(20, [asignacion(10)]);
      oikosSedes();
      const res = await request(app.getHttpServer())
        .get('/supervisores/contrato/42')
        .expect(200);
      expect(crud.isDone()).toBe(true);
      expect(res.body.Data[0]).toEqual(
        expect.objectContaining({
          nombre_supervisor: 'SUPERVISOR DE PRUEBA',
          sede: 'Sede Calle 40',
          dependencia: 'Facultad de Ingeniería',
        }),
      );
      expect(res.body.Data[0]).not.toHaveProperty('sede_id');
    });

    it('con varias sedes en la dependencia usa la sede del legado', async () => {
      crudSupervisores([supervisor()]);
      supervisoresMid();
      oikosDependencia(20, [asignacion(10), asignacion(11)]);
      oikosSedes();
      const res = await request(app.getHttpServer())
        .get('/supervisores/contrato/42')
        .expect(200);
      expect(res.body.Data[0].sede).toBe('SEDE LEGADO');
    });

    it('sin dependencia_id no consulta Oikos y usa los nombres del legado', async () => {
      crudSupervisores([supervisor({ dependencia_id: null })]);
      supervisoresMid();
      const oikos = oikosDependencia(20, [asignacion(10)]);
      const res = await request(app.getHttpServer())
        .get('/supervisores/contrato/42')
        .expect(200);
      expect(oikos.isDone()).toBe(false);
      expect(res.body.Data[0]).toEqual(
        expect.objectContaining({
          sede: 'SEDE LEGADO',
          dependencia: 'Facultad de Ingeniería',
        }),
      );
    });

    it('404: contrato sin supervisores (antes respondía 500)', async () => {
      crudSupervisores([]);
      const res = await request(app.getHttpServer())
        .get('/supervisores/contrato/42')
        .expect(404);
      expect(res.body.message).toContain('contrato 42');
    });

    it('si Oikos falla, responde con los nombres del legado', async () => {
      crudSupervisores([supervisor()]);
      supervisoresMid();
      oikosDependencia(20, {}, 503);
      oikosSedes();
      const res = await request(app.getHttpServer())
        .get('/supervisores/contrato/42')
        .expect(200);
      expect(res.body.Data[0]).toEqual(
        expect.objectContaining({
          sede: 'SEDE LEGADO',
          dependencia: 'Facultad de Ingeniería',
        }),
      );
    });
  });
});
