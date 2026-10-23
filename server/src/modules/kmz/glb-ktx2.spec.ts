import {
  KTX2_WEBP_GPU_LIMIT,
  isKtx2Variant,
  ktx2Mode,
  ktx2ObjectName,
  shouldBuildKtx2,
  webpGpuBytes,
} from './glb-ktx2';

const page = (size: number, mime = 'image/webp') => ({
  width: size,
  height: size,
  mime,
});

describe('KTX2 variant policy', () => {
  it('keeps a single 4K page as WebP (fits every GPU budget)', () => {
    expect(webpGpuBytes([page(4096)])).toBeLessThan(KTX2_WEBP_GPU_LIMIT);
    expect(shouldBuildKtx2([page(4096)])).toBe(false);
  });

  it('builds KTX2 for an 8K page or several 4K pages', () => {
    expect(shouldBuildKtx2([page(8192)])).toBe(true);
    expect(shouldBuildKtx2([page(4096), page(4096)])).toBe(true);
  });

  it('honours GLB_KTX2 and skips files that are already KTX2', () => {
    expect(shouldBuildKtx2([page(1024)], 'always')).toBe(true);
    expect(shouldBuildKtx2([page(8192)], 'off')).toBe(false);
    expect(shouldBuildKtx2([page(8192, 'image/ktx2')], 'always')).toBe(false);
    expect(shouldBuildKtx2([], 'always')).toBe(false);
    expect(ktx2Mode({ GLB_KTX2: 'ALWAYS' })).toBe('always');
    expect(ktx2Mode({ GLB_KTX2: 'nonsense' })).toBe('auto');
  });

  it('names the variant beside the served file', () => {
    expect(ktx2ObjectName('schools/a/3d/site.glb')).toBe(
      'schools/a/3d/site.ktx2.glb',
    );
    expect(isKtx2Variant('site.ktx2.glb')).toBe(true);
    expect(isKtx2Variant('site.glb')).toBe(false);
  });
});
