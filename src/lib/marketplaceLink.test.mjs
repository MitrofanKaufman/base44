import assert from 'node:assert/strict';
import test from 'node:test';
import { extractWbArticleFromInput } from './marketplaceLink.js';

test('extracts WB article from catalog URL', () => {
  assert.equal(
    extractWbArticleFromInput('https://www.wildberries.ru/catalog/286175495/detail.aspx?targetUrl=GP'),
    '286175495',
  );
});

test('extracts WB article from plain article input', () => {
  assert.equal(extractWbArticleFromInput('286175495'), '286175495');
});

test('extracts WB article from pasted text', () => {
  assert.equal(extractWbArticleFromInput('WB article: 286175495'), '286175495');
});

test('ignores non-WB URLs without catalog pattern', () => {
  assert.equal(extractWbArticleFromInput('https://example.com/products/286175495'), '');
});

test('ignores non-WB catalog URLs', () => {
  assert.equal(extractWbArticleFromInput('https://example.com/catalog/286175495/detail.aspx'), '');
});
