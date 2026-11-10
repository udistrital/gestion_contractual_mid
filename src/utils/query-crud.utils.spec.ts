import {
  aCuerpoCrud,
  aFormaConsumidores,
  aQueryCrud,
} from './query-crud.utils';

describe('aQueryCrud', () => {
  it('une los filtros en formato campo:valor', () => {
    expect(aQueryCrud({ activo: true, tipo_documento_id: 6805 })).toEqual({
      query: 'activo:true,tipo_documento_id:6805',
    });
  });

  it('filtra las llaves foráneas por su id', () => {
    expect(aQueryCrud({ contrato_general_id: 7, poliza_id: 2 })).toEqual({
      query: 'contrato_general_id.id:7,poliza_id.id:2',
    });
  });

  it('traduce el orden y pasa la dirección a minúscula', () => {
    expect(
      aQueryCrud({}, { sortBy: 'fecha_creacion', orderBy: 'DESC' }),
    ).toEqual({ sortby: 'fecha_creacion', order: 'desc' });
  });

  it('omite lo que no se envía', () => {
    expect(aQueryCrud()).toEqual({});
  });
});

describe('aCuerpoCrud', () => {
  it('envía las llaves foráneas como { id }', () => {
    expect(
      aCuerpoCrud({ contrato_general_id: 7, poliza_id: '2', valor: 10 }),
    ).toEqual({
      contrato_general_id: { id: 7 },
      poliza_id: { id: 2 },
      valor: 10,
    });
  });

  it('conserva null y las llaves que ya vienen como objeto', () => {
    expect(
      aCuerpoCrud({ poliza_id: null, contrato_general_id: { id: 7 } }),
    ).toEqual({ poliza_id: null, contrato_general_id: { id: 7 } });
  });

  it('no toca los arreglos ni un cuerpo vacío', () => {
    const lote = [{ contrato_general_id: 7 }];

    expect(aCuerpoCrud(lote)).toBe(lote);
    expect(aCuerpoCrud(undefined)).toBeUndefined();
  });
});

describe('aFormaConsumidores', () => {
  it('reduce las llaves foráneas a su id y las fechas a YYYY-MM-DD', () => {
    expect(
      aFormaConsumidores({
        id: 1,
        contrato_general_id: { id: 7, numero_contrato: null },
        poliza_id: { id: 2 },
        fecha_inicio: '2026-01-01T00:00:00Z',
        fecha_fin: null,
      }),
    ).toEqual({
      id: 1,
      contrato_general_id: 7,
      poliza_id: 2,
      fecha_inicio: '2026-01-01',
      fecha_fin: null,
    });
  });

  it('conserva poliza_id en null', () => {
    expect(aFormaConsumidores({ poliza_id: null })).toEqual({ poliza_id: null });
  });
});
