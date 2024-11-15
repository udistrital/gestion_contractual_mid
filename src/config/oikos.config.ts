import { registerAs } from '@nestjs/config';

export const oikosConfig = registerAs('oikos', () => ({
  espaciosFisicosEndpoint: process.env.ENDP_OIKOS_ESPACIOS_FISICOS,
  idSedeOikos: 38,
}));
