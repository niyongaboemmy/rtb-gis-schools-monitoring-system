/**
 * Which file in a school's `3d/` folder is the served model. Extra builds sit
 * beside it (`<name>.ktx2.glb`, the GPU-compressed variant the API picks per
 * device), and must never be served as the main model.
 */
const isVariant = (f) => /\.ktx2\.glb$/i.test(f);

function pickServedModel(files) {
  const models = files.filter((f) => f.toLowerCase().endsWith('.glb') && !isVariant(f));
  return models[0] ?? null;
}

module.exports = { pickServedModel };
