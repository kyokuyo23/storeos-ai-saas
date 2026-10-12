/**
 * Test doubles helpers for drizzle's PostgreSQL query builder shape: inserts and updates are
 * awaitable *and* chainable (`.returning()`, `.onConflictDoUpdate()`), unlike the old mysql2 shape.
 */
type Thenable<T> = Promise<T> & { returning: (..._args: unknown[]) => Promise<any>; onConflictDoUpdate: (..._args: unknown[]) => Promise<T>; onConflictDoNothing: (..._args: unknown[]) => Promise<T> };

export function pgValues<A extends unknown[], T>(fn: (...args: A) => Promise<T>) {
  return (...args: A): Thenable<T> => {
    const promise = fn(...args);
    return Object.assign(promise, { returning: () => promise, onConflictDoUpdate: () => promise, onConflictDoNothing: () => promise });
  };
}

/** `where` doubles that report `{ affectedRows }` (mysql2 style) are translated to RETURNING rows. */
export function pgWhere<A extends unknown[], T>(fn: (...args: A) => Promise<T> | T) {
  return (...args: A) => {
    const promise = Promise.resolve(fn(...args));
    return Object.assign(promise, {
      returning: () => promise.then((result) => {
        const affected = (result as { affectedRows?: number } | undefined)?.affectedRows;
        return typeof affected === "number" ? Array.from({ length: affected }, (_, index) => ({ id: index + 1 })) : [{ id: 1 }];
      }),
    });
  };
}
