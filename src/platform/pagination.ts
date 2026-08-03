export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  from: number;
  to: number;
};

type PaginationOptions = {
  defaultPageSize: number;
  allowedPageSizes: readonly number[];
  maximumPage?: number;
};

function positiveInteger(value: string | null | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parsePagination(
  values: { page?: string | null; pageSize?: string | null },
  options: PaginationOptions,
) {
  const requestedSize = positiveInteger(
    values.pageSize,
    options.defaultPageSize,
  );
  const pageSize = options.allowedPageSizes.includes(requestedSize)
    ? requestedSize
    : options.defaultPageSize;
  const page = Math.min(
    positiveInteger(values.page, 1),
    options.maximumPage ?? 100_000,
  );
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function paginationMeta(
  page: number,
  pageSize: number,
  totalItems: number,
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = totalItems === 0 ? 0 : Math.min(safePage * pageSize, totalItems);
  return { page: safePage, pageSize, totalItems, totalPages, from, to };
}

export function pageNumbers(page: number, totalPages: number) {
  if (totalPages <= 7)
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  const values = new Set([1, totalPages, page - 1, page, page + 1]);
  return [...values]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right);
}
