import { describe, expect, it } from "vitest";

import {
  pageNumbers,
  paginationMeta,
  parsePagination,
} from "../../src/platform/pagination";

describe("pagination contracts", () => {
  it("uses approved page sizes and a safe default", () => {
    expect(
      parsePagination(
        { page: "3", pageSize: "50" },
        { defaultPageSize: 20, allowedPageSizes: [20, 50, 100] },
      ),
    ).toEqual({ page: 3, pageSize: 50, offset: 100 });
    expect(
      parsePagination(
        { page: "-2", pageSize: "999" },
        { defaultPageSize: 20, allowedPageSizes: [20, 50, 100] },
      ),
    ).toEqual({ page: 1, pageSize: 20, offset: 0 });
  });

  it("reports the visible range and clamps an empty or excessive page", () => {
    expect(paginationMeta(2, 20, 47)).toEqual({
      page: 2,
      pageSize: 20,
      totalItems: 47,
      totalPages: 3,
      from: 21,
      to: 40,
    });
    expect(paginationMeta(99, 20, 3).page).toBe(1);
    expect(paginationMeta(1, 20, 0)).toMatchObject({ from: 0, to: 0 });
  });

  it("keeps compact page-number navigation for long histories", () => {
    expect(pageNumbers(6, 12)).toEqual([1, 5, 6, 7, 12]);
  });
});
