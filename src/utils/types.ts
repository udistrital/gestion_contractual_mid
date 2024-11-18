export interface SedeResponse {
  Id: number;
  Nombre: string;
}

export interface DependenciaResponse {
  DependenciaId: {
    Id: number;
    Nombre: string;
    TelefonoDependencia: string;
    CorreoElectronico: string;
    Activo: boolean;
    FechaCreacion: string;
    FechaModificacion: string;
    DependenciaTipoDependencia: null;
  };
  Id: number;
}

export interface DependenciaSimple {
  id: number;
  nombre: string;
}

export interface EstadoContratoResponse {
  id: number;
  usuario_id: number;
  estado_parametro_id: number | null;
  motivo: string;
  fecha_ejecucion_estado: string;
  activo: boolean;
  fecha_creacion: string | null;
  fecha_modificacion: string;
}
