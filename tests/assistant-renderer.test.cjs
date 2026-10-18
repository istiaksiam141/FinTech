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
