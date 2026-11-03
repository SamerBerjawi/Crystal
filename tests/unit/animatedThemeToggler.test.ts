import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnimatedThemeToggler } from '../../components/ui/animated-theme-toggler';

test('AnimatedThemeToggler is exported as a React functional component', () => {
  assert.equal(typeof AnimatedThemeToggler, 'function');
});
