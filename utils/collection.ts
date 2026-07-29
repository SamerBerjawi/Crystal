export type EntityWithId = { id: string };

export const upsertEntity = <T extends EntityWithId>(
  items: T[],
  itemData: Omit<T, 'id'> & { id?: string },
  createId: () => string = () => '',
): T[] => {
  if (itemData.id) {
    const exists = items.some(item => item.id === itemData.id);
    if (exists) {
      return items.map(item => (item.id === itemData.id ? ({ ...item, ...itemData } as T) : item));
    }
    return [...items, itemData as T];
  }

  return [...items, { ...itemData, id: createId() } as T];
};

export const removeEntityById = <T extends EntityWithId>(items: T[], id: string): T[] => {
  return items.filter(item => item.id !== id);
};
