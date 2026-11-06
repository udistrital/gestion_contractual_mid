import {
  aCuerpoBeego,
  aFormaAnterior,
  aQueryBeego,
} from './query-beego.utils';

describe('aQueryBeego', () => {
  it('une los filtros en formato campo:valor', () => {
    expect(aQueryBeego({ activo: true, tipo_documento_id: 6805 })).toEqual({
      query: 'activo:true,tipo_documento_id:6805',
    });
  });

  it('filtra las llaves foráneas por su id', () => {
    expect(aQueryBeego({ contrato_general_id: 7, poliza_id: 2 })).toEqual({
      query: 'contrato_general_id.id:7,poliza_id.id:2',
    });
  });

  it('traduce el orden y pasa la dirección a minúscula', () => {
    expect(
      aQueryBeego({}, { sortBy: 'fecha_creacion', orderBy: 'DESC' }),
    ).toEqual({ sortby: 'fecha_creacion', order: 'desc' });
  });

  it('omite lo que no se envía', () => {
    expect(aQueryBeego()).toEqual({});
  });
});

describe('aCuerpoBeego', () => {
  it('envía las llaves foráneas como { id }', () => {
    expect(
      aCuerpoBeego({ contrato_general_id: 7, poliza_id: '2', valor: 10 }),
    ).toEqual({
      contrato_general_id: { id: 7 },
      poliza_id: { id: 2 },
      valor: 10,
    });
  });

  it('conserva null y las llaves que ya vienen como objeto', () => {
    expect(
      aCuerpoBeego({ poliza_id: null, contrato_general_id: { id: 7 } }),
    ).toEqual({ poliza_id: null, contrato_general_id: { id: 7 } });
  });

  it('no toca los arreglos ni un cuerpo vacío', () => {
    const lote = [{ contrato_general_id: 7 }];

    expect(aCuerpoBeego(lote)).toBe(lote);
    expect(aCuerpoBeego(undefined)).toBeUndefined();
  });
});

describe('aFormaAnterior', () => {
  it('reduce las llaves foráneas a su id y las fechas a YYYY-MM-DD', () => {
    expect(
      aFormaAnterior({
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
    expect(aFormaAnterior({ poliza_id: null })).toEqual({ poliza_id: null });
  });
});
