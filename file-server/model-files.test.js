const test = require('node:test');
const assert = require('node:assert');
const { pickServedModel } = require('./model-files');

test('serves the model, never its KTX2 variant', () => {
  assert.equal(pickServedModel(['site.ktx2.glb', 'site.glb']), 'site.glb');
  assert.equal(pickServedModel(['a.KTX2.GLB', 'b.glb', 'notes.json']), 'b.glb');
  assert.equal(pickServedModel(['site.ktx2.glb']), null);
  assert.equal(pickServedModel([]), null);
});
