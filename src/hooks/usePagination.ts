import { useEffect, useMemo, useState } from "react";

export function usePagination<T>(items: T[], initialSize = 25, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize, items.length]);

  const paged = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  return {
    page,
    pageSize,
    total: items.length,
    paged,
    setPage,
    setPageSize,
  };
}
