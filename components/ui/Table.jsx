'use client';

import EmptyState from './EmptyState';

function resolveAlignClass(align) {
  if (align === 'right') return 'table__cell--right';
  if (align === 'center') return 'table__cell--center';
  return 'table__cell--left';
}

function defaultRowKey(row, index) {
  if (row && (row.id !== undefined && row.id !== null)) return String(row.id);
  if (row && row.reference) return String(row.reference);
  return `row-${index}`;
}

export default function Table({
  columns = [],
  rows = [],
  getRowKey,
  emptyMessage = 'Nothing to show yet.',
  emptyTitle = 'Nothing here',
  emptyAction = null,
  caption,
}) {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeRows = Array.isArray(rows) ? rows : [];

  if (safeColumns.length === 0) {
    return (
      <EmptyState
        title="Table unavailable"
        description="No columns were provided for this table."
      />
    );
  }

  if (safeRows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyMessage}
        action={emptyAction}
      />
    );
  }

  const keyFor = typeof getRowKey === 'function' ? getRowKey : defaultRowKey;

  return (
    <div className="table-wrap" role="region" aria-label={caption || 'Data table'} tabIndex={0}>
      <table className="table">
        {caption ? <caption className="table__caption">{caption}</caption> : null}
        <thead className="table__head">
          <tr>
            {safeColumns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`table__th ${resolveAlignClass(column.align)}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="table__body">
          {safeRows.map((row, rowIndex) => (
            <tr key={keyFor(row, rowIndex)} className="table__row">
              {safeColumns.map((column) => {
                let content;
                try {
                  content =
                    typeof column.render === 'function'
                      ? column.render(row, rowIndex)
                      : row
                        ? row[column.key]
                        : null;
                } catch (error) {
                  content = '—';
                }

                if (content === undefined || content === null || content === '') {
                  content = '—';
                }

                return (
                  <td
                    key={column.key}
                    className={`table__td ${resolveAlignClass(column.align)}`}
                    data-label={typeof column.header === 'string' ? column.header : undefined}
                  >
                    <span className="table__cell-inner user-text">{content}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}