/** 统一从 catch 里取可读错误信息（供 Toast / 占位文案） */
export function msgFromCatch(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
