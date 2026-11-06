// Llaves foráneas del CRUD Beego v2: se filtran por el id del objeto relacionado.
const LLAVES_FORANEAS = ['contrato_general_id', 'poliza_id'];

// Columnas date de póliza y amparo: el CRUD Beego v2 las entrega con hora.
const COLUMNAS_FECHA = [
  'fecha_inicio',
  'fecha_fin',
  'fecha_expedicion',
  'fecha_aprobacion',
];

interface OrdenConsulta {
  sortBy?: string;
  orderBy?: string;
}

// Convierte un filtro y un orden al formato del CRUD Beego v2:
// query=campo:valor,campo:valor&sortby=campo&order=asc|desc
export const aQueryBeego = (
  filtro: Record<string, unknown> = {},
  { sortBy, orderBy }: OrdenConsulta = {},
): Record<string, string> => {
  const query = Object.entries(filtro)
    .map(([campo, valor]) =>
      LLAVES_FORANEAS.includes(campo)
        ? `${campo}.id:${valor}`
        : `${campo}:${valor}`,
    )
    .join(',');

  return {
    ...(query && { query }),
    ...(sortBy && { sortby: sortBy }),
    ...(orderBy && { order: orderBy.toLowerCase() }),
  };
};

// El CRUD Beego v2 recibe las llaves foráneas como { id }. Los arreglos no se
// tocan: el registro en lote sigue en la ruta anterior.
export const aCuerpoBeego = (cuerpo: any): any => {
  if (!cuerpo || Array.isArray(cuerpo)) return cuerpo;

  const resultado = { ...cuerpo };
  LLAVES_FORANEAS.forEach((campo) => {
    const valor = resultado[campo];
    if (valor != null && typeof valor !== 'object') {
      resultado[campo] = { id: Number(valor) };
    }
  });
  return resultado;
};

// Devuelve un registro del CRUD Beego v2 en la forma que siguen usando el MF y
// minuta_contractual_mid: llaves foráneas como id y fechas sin hora.
export const aFormaAnterior = (registro: any): any => {
  const resultado = { ...registro };
  LLAVES_FORANEAS.forEach((campo) => {
    if (resultado[campo]?.id !== undefined) {
      resultado[campo] = resultado[campo].id;
    }
  });
  COLUMNAS_FECHA.forEach((campo) => {
    if (typeof resultado[campo] === 'string') {
      resultado[campo] = resultado[campo].slice(0, 10);
    }
  });
  return resultado;
};
