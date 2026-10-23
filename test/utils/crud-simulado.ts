import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';

export interface PeticionRegistrada {
  method: string;
  path: string;
  query: Record<string, string>;
}

export type Manejador = (
  peticion: PeticionRegistrada,
  req: IncomingMessage,
  res: ServerResponse,
) => void;

/**
 * Servidor HTTP local que simula los CRUD que consume el MID (parametros_crud,
 * gestion_contractual_crud, terceros_crud) dentro de la propia prueba.
 * Registra cada petición recibida para poder verificar qué consultó el MID.
 */
export class CrudSimulado {
  readonly peticiones: PeticionRegistrada[] = [];
  private readonly rutas = new Map<string, Manejador>();
  private server: Server;

  get url(): string {
    const { port } = this.server.address() as AddressInfo;
    return `http://127.0.0.1:${port}/`;
  }

  /** Registra un manejador para la ruta (sin query), p. ej. '/parametro'. */
  en(path: string, manejador: Manejador): this {
    this.rutas.set(path, manejador);
    return this;
  }

  /** Peticiones recibidas en una ruta. */
  llamadas(path: string): PeticionRegistrada[] {
    return this.peticiones.filter((p) => p.path === path);
  }

  limpiar(): void {
    this.peticiones.length = 0;
    this.rutas.clear();
  }

  iniciar(): Promise<void> {
    this.server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://crud-simulado');
      const peticion: PeticionRegistrada = {
        method: req.method ?? 'GET',
        path: url.pathname,
        query: Object.fromEntries(url.searchParams.entries()),
      };
      this.peticiones.push(peticion);
      const manejador =
        this.rutas.get(url.pathname) ??
        [...this.rutas.entries()].find(([ruta]) =>
          ruta.endsWith('*')
            ? url.pathname.startsWith(ruta.slice(0, -1))
            : false,
        )?.[1];
      if (!manejador) {
        responderJson(res, 404, {});
        return;
      }
      manejador(peticion, req, res);
    });
    return new Promise((resolve) =>
      this.server.listen(0, '127.0.0.1', () => resolve()),
    );
  }

  detener(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }
}

export function responderJson(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** Respuesta con el formato de parametros_crud (Beego). */
export function respuestaParametros(Data: unknown[]) {
  return { Success: true, Status: '200', Message: 'Request successful', Data };
}
