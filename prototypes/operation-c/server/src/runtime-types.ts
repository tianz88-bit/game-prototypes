// Module-scoped subset of the Workers runtime; avoids new dependencies and
// collisions with Firestorm's existing local ambient declarations.
export interface RoomSocket extends WebSocket {
  accept(): void;
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}
export interface RoomStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  deleteAll(): Promise<void>;
  setAlarm(time: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}
export interface RoomObjectState {
  storage: RoomStorage;
  acceptWebSocket(socket: WebSocket, tags?: string[]): void;
  getWebSockets(): RoomSocket[];
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
}
export interface RoomNamespace { idFromName(name: string): unknown; get(id: unknown): { fetch(request: Request): Promise<Response> } }
export interface RoomWorkerEnvironment { OPERATION_C_ROOMS: RoomNamespace }
