import React, { CSSProperties, ReactNode, useCallback, useMemo, useState } from 'react';

interface VirtualizedListProps {
  height: number;
  width?: number | string;
  itemCount: number;
  estimatedItemSize: number;
  getItemSize?: (index: number) => number;
  itemKey?: (index: number) => string | number;
  children: (props: { index: number; style: CSSProperties }) => ReactNode;
}

interface Measurement {
  size: number;
  offset: number;
}

const defaultKey = (index: number) => index;

const VirtualizedList: React.FC<VirtualizedListProps> = ({
  height,
  width = '100%',
  itemCount,
  estimatedItemSize,
  getItemSize,
  itemKey = defaultKey,
  children,
}) => {
  const [scrollOffset, setScrollOffset] = useState(0);

  if (itemCount === 0) {
    return (
      <div style={{ height, width, overflowY: 'auto', position: 'relative' }}>
        <div style={{ height: 0 }} />
      </div>
    );
  }

  const measurements = useMemo(() => {
    const sizes: Measurement[] = [];
    let offset = 0;

    for (let i = 0; i < itemCount; i++) {
      const size = getItemSize ? getItemSize(i) : estimatedItemSize;
      sizes.push({ size, offset });
      offset += size;
    }

    return { sizes, totalSize: offset };
  }, [estimatedItemSize, getItemSize, itemCount]);

  const findStartIndex = useCallback((target: number) => {
    let low = 0;
    let high = measurements.sizes.length - 1;
    let match = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const { offset, size } = measurements.sizes[mid];
      if (offset <= target && offset + size > target) {
        match = mid;
        break;
      }
      if (offset > target) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
      match = low;
    }

    return Math.max(0, Math.min(match, itemCount - 1));
  }, [itemCount, measurements.sizes]);

  const startIndex = useMemo(() => findStartIndex(scrollOffset), [findStartIndex, scrollOffset]);
  const endIndex = useMemo(() => {
    const maxOffset = scrollOffset + height;
    let index = startIndex;

    while (index < itemCount && measurements.sizes[index].offset < maxOffset) {
      index += 1;
    }

    return Math.min(index, itemCount - 1);
  }, [height, itemCount, measurements.sizes, scrollOffset, startIndex]);

  const items: ReactNode[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    const measurement = measurements.sizes[i];
    const style: CSSProperties = {
      position: 'absolute',
      top: measurement.offset,
      height: measurement.size,
      width: '100%',
    };

    items.push(
      <div key={itemKey(i)} style={style}>
        {children({ index: i, style: { height: '100%', width: '100%' } })}
      </div>
    );
  }

  return (
    <div
      style={{ height, width, overflowY: 'auto', position: 'relative' }}
      onScroll={(e) => setScrollOffset(e.currentTarget.scrollTop)}
    >
      <div style={{ height: measurements.totalSize, position: 'relative' }}>
        {items}
      </div>
    </div>
  );
};

export default VirtualizedList;
