export interface ResponseMetadata {
  total: number;
  limit: number;
  offset: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  Data: T[];
  Metadata: ResponseMetadata;
}

export interface StandardResponse<T> {
  Success: boolean;
  Status: number;
  Message: string;
  Data?: T;
  Metadata?: ResponseMetadata;
}

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

export interface CDPResponse {
  id: number;
  numero_cdp_id: number;
  fecha_registro: string;
  vigencia_cdp: number;
  activo: boolean;
  fecha_creacion: string;
  fecha_modificacion: string;
}

export interface LugarEjecucionResponse<T> {
  id: number;
  pais_id: number;
  ciudad_id: number;
  municipio_id: number;
  dependencia_id: number;
  sede_id: number;
  direccion: string;
  activo: boolean;
  fecha_creacion: string;
  fecha_modificacion: string;
}

export interface ProveedorResponse {
  proveedor: {
    id_proveedor: string;
    ciudad_expedicion_documento: string;
    id_ciudad_contacto: string;
    direccion: string;
    numero_documento: string;
    nombre_estado: string;
    numero_cuenta_bancaria: string;
    id_ciudad_expedicion_documento: string;
    id_estado: string;
    nombre_completo_proveedor: string;
    ciudad_contacto: string;
    web: string;
    fecha_registro: string;
    correo: string;
    id_entidad_bancaria: string;
    tipo_persona: string;
    tipo_cuenta_bancaria: string;
    fecha_ultima_modificacion: string;
  };
  contratos?: Array<{
    vigencia: string;
    numero_contrato: string;
    tipo_contrato: {
      id: string;
      nombre: string;
    };
    estado_contrato: {
      id: string;
      nombre: string;
    };
  }>;
}

export interface VariablesResponse {
  valorPesos: string;
  numero_cdp_id: number;
  vigencia_cdp: number;
  plazoEjecucion: number;
  unidadEjecutoraId: number;
  ciudad_id: number;
  modoPago: string;
  ordenadorId: number;
  sede_id: number;
  direccion: string;
  correo: string;
}