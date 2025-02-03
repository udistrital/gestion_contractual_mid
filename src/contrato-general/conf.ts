import { environment } from 'src/environments/environment';

// Configuración número de contrato
export const datos: any = {
  [environment.UNIDADES_EJECUTORAS.RECTORIA]: {
    prefijo: '',
    sufijo: '',
  },
  [environment.UNIDADES_EJECUTORAS.IDEXUD]: {
    prefijo: 'ID-',
    sufijo: '',
  },
};
