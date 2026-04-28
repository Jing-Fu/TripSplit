import { Prisma } from "@prisma/client";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function serializePrisma<T>(value: T): T {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber() as T;
  }

  if (value instanceof Date || value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializePrisma(item)) as T;
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializePrisma(item)])
    ) as T;
  }

  return value;
}
