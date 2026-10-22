/** Client-safe: shared by server actions and the forms that call them. */
export type ActionState = { ok: boolean; error?: string; message?: string };

export const initialState: ActionState = { ok: false };
