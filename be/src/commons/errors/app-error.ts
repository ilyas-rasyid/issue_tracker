export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public errors?: {
      field: string;
      message: string;
    }[],
  ) {
    super(message);
  }
}
export function assert(
  condition: unknown,
  status: number,
  code: string,
  message: string,
): asserts condition {
  if (!condition) {
    throw new AppError(status, code, message);
  }
}
export const isUniqueError = (e: any) => e?.code === 'P2002';
export const isConflictError = (e: any) => e?.code === 'P2034';
