export type ActionResponse<T = void> =
  | { success: true; data: T; requestId?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]>; requestId?: string }
