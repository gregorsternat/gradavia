"use client";

import { useMemo, useState } from "react";
import { useMotionActive } from "@/lib/hooks/use-reduced-motion";
import { Table, type TableProps } from ".";
import { LoadProgress } from "./progress";
import { useColumnSort } from "./use-column-sort";

export type AsyncTableProps<T> = TableProps<T> & {
  total?: number;
  hasMore?: boolean;
  error?: string | null;
  retryLabel?: string;
  onRetry?: () => void;
};

/** beUI async composition. Local populations are sorted before taking a batch. */
export function AsyncTable<T>({
  data,
  total,
  hasMore,
  error,
  retryLabel,
  onRetry,
  onEndReached,
  getRowId,
  ...props
}: AsyncTableProps<T>) {
  const active = useMotionActive();
  const remote = total !== undefined;
  const rows = useMemo(
    () =>
      data.map((row, index) => ({
        row,
        id: getRowId?.(row, index) ?? JSON.stringify(row),
      })),
    [data, getRowId],
  );
  const { sortedRows, sort, toggleSort } = useColumnSort({
    rows,
    columns: props.columns,
    sort: props.sort,
    defaultSort: props.defaultSort ?? null,
    onSortChange: props.onSortChange,
  });
  const identity = JSON.stringify([sort, rows.map(({ id }) => id)]);
  const [window, setWindow] = useState({ identity, limit: 25 });
  if (window.identity !== identity) setWindow({ identity, limit: 25 });
  const limit = window.identity === identity ? window.limit : 25;
  const visible = remote
    ? data
    : sortedRows.slice(0, limit).map(({ row }) => row);
  const more = remote ? (hasMore ?? false) : limit < data.length;
  const loadMore = () => {
    if (!active || props.loading) return;
    if (remote) onEndReached?.();
    else setWindow({ identity, limit: limit + 25 });
  };
  return (
    <>
      <Table
        resetScrollKey={remote ? undefined : identity}
        {...props}
        data={visible}
        getRowId={getRowId}
        sort={sort}
        onSortChange={(next) => toggleSort(next?.key ?? sort?.key ?? "")}
        totalRows={total ?? data.length}
        onEndReached={active && more && !error ? loadMore : undefined}
      />
      {(remote || data.length > 25) && (
        <LoadProgress
          count={visible.length}
          total={total ?? data.length}
          hasMore={more}
          loading={props.loading}
          error={error}
          onLoadMore={error && onRetry ? onRetry : loadMore}
          retryLabel={retryLabel}
        />
      )}
    </>
  );
}

export type { TableColumn } from ".";
