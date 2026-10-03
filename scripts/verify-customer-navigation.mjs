import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsx from 'react/jsx-runtime';
import ts from 'typescript';
function load(file, dependencies, globals = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { exports, require: name => {
    assert.ok(name in dependencies, `Missing dependency: ${name}`);
    return dependencies[name];
  }, ...globals });
  return exports;
}
const icon = load('components/customer-nav-icon.tsx', { 'react/jsx-runtime': jsx });
let scrolls = 0;
const { CustomerNavigation } = load('components/customer-navigation.tsx', {
  'react/jsx-runtime': jsx, './customer-nav-icon': icon,
}, { window: { scrollTo: () => { scrolls++; } } });
const tabs = ['rewards', 'coupons', 'home', 'lucky', 'account'];
for (const activeTab of tabs) {
  let selected;
  const navigation = CustomerNavigation({ activeTab, onSelect: tab => { selected = tab; } });
  const html = renderToStaticMarkup(navigation);
  assert.equal((html.match(/<button /g) || []).length, 5);
  assert.equal((html.match(/<svg /g) || []).length, 5, 'Every tab must render its actual icon');
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  const buttons = navigation.props.children;
  assert.equal(buttons[tabs.indexOf(activeTab)].props['aria-current'], 'page');
  buttons.forEach((button, index) => {
    button.props.onClick();
    assert.equal(selected, tabs[index], 'Tab must navigate to the intended section');
  });
}
assert.equal(scrolls, 25);
console.log('PASS: all five actual tab icons render; one active tab; all 25 navigation clicks select the correct section without undefined components.');
