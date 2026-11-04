import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SwitchButton } from '../../components/ui/switch-button';

test('SwitchButton is exported as a React functional component', () => {
  assert.equal(typeof SwitchButton, 'function');
});
