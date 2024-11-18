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
