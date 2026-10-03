export interface Operation {
  path: string;
  method: string;
  hasQuery: boolean;
}

export type Operations = Map<string, Operation>;
