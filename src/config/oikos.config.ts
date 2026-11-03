import { registerAs } from '@nestjs/config';

export const oikosConfig = registerAs('oikos', () => ({
  espaciosFisicosEndpoint: process.env.OIKOS_ESPACIOS_FISICOS_SERVICE,
  idSedeOikos: 38,
}));
