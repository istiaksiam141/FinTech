const test = require('node:test');
const assert = require('node:assert/strict');
const { render } = require('../lib/assistant-renderer.js');

class FakeNode {
  constructor(tag, text = '') { this.tagName = tag; this.children = []; this.text = text; this.attributes = {}; this.ownerDocument = null; }
  appendChild(node) { this.children.push(node); return node; }
  removeChild(node) { this.children.splice(this.children.indexOf(node), 1); }
  get firstChild() { return this.children[0] || null; }
  set textContent(value) { this.children = []; this.text = String(value); }
  get textContent() { return this.text + this.children.map(node => node.textContent).join(''); }
  setAttribute(name, value) { this.attributes[name] = value; }
}
const fakeDocument = {
  createElement(tag) { const node = new FakeNode(tag); node.ownerDocument = fakeDocument; return node; },
  createTextNode(text) { return new FakeNode('#text', text); }
};

test('assistant renderer formats headings, paragraphs, bullets, steps, and inline emphasis', () => {
  const root = fakeDocument.createElement('div');
  render(root, '## Simple answer\n\nA **clear** explanation.\n\n- First point\n- Second point\n\n1. Check the source\n2. Compare the terms', fakeDocument);
  assert.deepEqual(root.children.map(node => node.tagName), ['h4', 'p', 'ul', 'ol']);
  assert.equal(root.children[1].children[1].tagName, 'strong');
  assert.deepEqual(root.children[2].children.map(node => node.tagName), ['li', 'li']);
  assert.deepEqual(root.children[3].children.map(node => node.textContent), ['Check the source', 'Compare the terms']);
});

test('assistant renderer treats HTML and unsafe links as text rather than executable markup', () => {
  const root = fakeDocument.createElement('div');
  render(root, '<img src=x onerror=alert(1)> [bad](javascript:alert(1))', fakeDocument);
  assert.equal(root.children[0].tagName, 'p');
  assert.equal(root.children[0].children.some(node => node.tagName === 'img' || node.tagName === 'a'), false);
  assert.match(root.textContent, /<img/);
  assert.match(root.textContent, /javascript/);
});

test('assistant renderer creates only safe links for HTTP(S) markdown destinations', () => {
  const root = fakeDocument.createElement('div');
  render(root, '[Official source](https://example.com/rates)', fakeDocument);
  const link = root.children[0].children[0];
  assert.equal(link.tagName, 'a');
  assert.equal(link.attributes.href, 'https://example.com/rates');
  assert.equal(link.attributes.rel, 'noopener noreferrer');
});

test('assistant renderer turns Markdown tables into semantic tables without exposing separators', () => {
  const root = fakeDocument.createElement('div');
  const markdown = '| Term | Meaning |\n| --- | :---: |\n| Waiver | Permission to give up a right |\n| Fee | A payment charge |';
  render(root, markdown, fakeDocument);
  const table = root.children[0];
  assert.equal(table.tagName, 'table');
  assert.deepEqual(table.children.map(node => node.tagName), ['thead', 'tbody']);
  assert.equal(table.children[0].children[0].children[0].tagName, 'th');
  assert.deepEqual(table.children[1].children.map(row => row.children.map(cell => cell.textContent)), [['Waiver', 'Permission to give up a right'], ['Fee', 'A payment charge']]);
  assert.doesNotMatch(root.textContent, /\|\s*:?-{3,}/);
});

test('assistant renderer keeps list punctuation and formats simple Markdown lists', () => {
  const root = fakeDocument.createElement('div');
  render(root, '**A waiver** may cover: The fee is $25.\n\n- A late fee\n- An application fee', fakeDocument);
  assert.equal(root.children[0].children[0].tagName, 'strong');
  assert.match(root.textContent, /\$25\./);
  assert.deepEqual(root.children[1].children.map(item => item.textContent), ['A late fee', 'An application fee']);
});

test('assistant renderer preserves underscores and multiplication while formatting valid emphasis', () => {
  const root = fakeDocument.createElement('div');
  render(root, 'my_variable_name and 5 * 2 * 3; **bold text** and *italic text*.', fakeDocument);
  const paragraph = root.children[0];
  assert.equal(paragraph.textContent, 'my_variable_name and 5 * 2 * 3; bold text and italic text.');
  assert.deepEqual(paragraph.children.filter(node => node.tagName !== '#text').map(node => node.tagName), ['strong', 'em']);
});

test('assistant renderer formats inline code and keeps fenced code literal', () => {
  const root = fakeDocument.createElement('div');
  render(root, 'Use `my_variable_name` here.\n\n```html\n<img src=x onerror=alert(1)>\n```', fakeDocument);
  assert.equal(root.children[0].children[1].tagName, 'code');
  assert.equal(root.children[0].children[1].textContent, 'my_variable_name');
  assert.equal(root.children[1].tagName, 'pre');
  assert.equal(root.children[1].children[0].tagName, 'code');
  assert.equal(root.children[1].textContent, '<img src=x onerror=alert(1)>');
});
