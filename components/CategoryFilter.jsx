'use client';

import { titleCase } from '../lib/format';

export default function CategoryFilter({ categories = [], active = 'all', onChange }) {
  const items = [
    { id: 'all', label: 'All pieces', count: categories.reduce((sum, c) => sum + (Number(c.count) || 0), 0) },
    ...categories.map((category) => ({
      id: category.id,
      label: category.label || titleCase(category.id),
      count: Number(category.count) || 0,
    })),
  ];

  function handleSelect(id) {
    if (typeof onChange === 'function' && id !== active) {
      onChange(id);
    }
  }

  return (
    <div className="filter-bar" role="group" aria-label="Filter by category">
      <div className="filter-bar__scroll cluster">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              className={`filter-pill${isActive ? ' filter-pill--active' : ''}`}
              aria-pressed={isActive}
              onClick={() => handleSelect(item.id)}
            >
              <span className="filter-pill__label truncate">{item.label}</span>
              {item.count > 0 ? <span className="filter-pill__count">{item.count}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}