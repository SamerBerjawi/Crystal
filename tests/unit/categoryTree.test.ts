import test from 'node:test';
import assert from 'node:assert/strict';
import { Category } from '../../types';
import { addSubCategory, filterCategories, moveCategory, removeCategory, shiftCategory, updateCategory } from '../../utils/categoryTree';

const cat = (id: string, subCategories: Category[] = [], color = '#000'): Category => ({ id, name: id, color, classification: 'expense', subCategories, icon: 'category' });
const tree = () => [cat('a', [cat('a1'), cat('a2')], '#111'), cat('b', [], '#222'), cat('c', [cat('c1')], '#333')];
const ids = (items: Category[]) => items.map(item => item.id);

test('edits, adds and removes work at any depth', () => {
  assert.equal(updateCategory(tree(), 'a2', { name: 'New', color: '#f00', icon: 'x' })[0].subCategories[1].name, 'New');
  assert.deepEqual(ids(addSubCategory(tree(), 'b', cat('b1'))[1].subCategories), ['b1']);
  assert.deepEqual(ids(removeCategory(tree(), 'a1')[0].subCategories), ['a2']);
  assert.deepEqual(ids(removeCategory(tree(), 'c')), ['a', 'b']);
});

test('a search keeps a parent for its matching children', () => {
  const result = filterCategories(tree(), 'c1');
  assert.deepEqual(ids(result), ['c']);
  assert.deepEqual(ids(filterCategories(tree(), 'A')), ['a']);
  assert.equal(filterCategories(tree(), 'A')[0].subCategories.length, 2);
  assert.deepEqual(filterCategories(tree(), 'zz'), []);
});

test('dropping beside reorders, and dropping into nests and adopts the colour', () => {
  assert.deepEqual(ids(moveCategory(tree(), 'c', 'a', 'top')), ['c', 'a', 'b']);
  assert.deepEqual(ids(moveCategory(tree(), 'a', 'b', 'bottom')), ['b', 'a', 'c']);
  const nested = moveCategory(tree(), 'c', 'b', 'middle');
  assert.deepEqual(ids(nested), ['a', 'b']);
  assert.equal(nested[1].subCategories[0].color, '#222');
  assert.equal(nested[1].subCategories[0].subCategories[0].color, '#222');
  assert.equal(nested[1].subCategories[0].parentId, 'b');
});

test('a sub-category can move to the top level', () => {
  const moved = moveCategory(tree(), 'a1', 'b', 'top');
  assert.deepEqual(ids(moved), ['a', 'a1', 'b', 'c']);
  assert.equal(moved[1].parentId, undefined);
});

test('a category never moves into itself or its own children', () => {
  const start = tree();
  assert.equal(moveCategory(start, 'a', 'a1', 'middle'), start);
  assert.equal(moveCategory(start, 'a', 'a', 'top'), start);
});

test('shifting swaps siblings and stops at the ends', () => {
  assert.deepEqual(ids(shiftCategory(tree(), 'b', -1)), ['b', 'a', 'c']);
  assert.deepEqual(ids(shiftCategory(tree(), 'a', -1)), ['a', 'b', 'c']);
  assert.deepEqual(ids(shiftCategory(tree(), 'a1', 1)[0].subCategories), ['a2', 'a1']);
});
