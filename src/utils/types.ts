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
