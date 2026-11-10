// Llaves foráneas que el CRUD filtra por el id del objeto relacionado.
const LLAVES_FORANEAS = ['contrato_general_id', 'poliza_id'];

interface OrdenConsulta {
  sortBy?: string;
  orderBy?: string;
}

// Convierte un filtro y un orden al formato de consulta del CRUD:
// query=campo:valor,campo:valor&sortby=campo&order=asc|desc
export const aQueryCrud = (
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
