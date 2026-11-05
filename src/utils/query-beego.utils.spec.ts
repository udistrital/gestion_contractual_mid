import { aQueryBeego } from './query-beego.utils';

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
