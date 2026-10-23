import {
  KTX2_WEBP_GPU_LIMIT,
  ktx2EstimatedBytes,
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

  it('builds KTX2 for an 8K page or several 4K pages, while the copy stays a reasonable download', () => {
    expect(shouldBuildKtx2([page(8192)])).toBe(true); // ≈ 77 MB
    expect(shouldBuildKtx2([page(4096), page(4096)])).toBe(true); // ≈ 39 MB
    expect(ktx2EstimatedBytes([page(4096)])).toBeCloseTo(19.3e6, -6);
  });

  it('skips a copy too big to download (Nyamirama: 1 texture + 11 drape pages ≈ 230 MB)', () => {
    const twelve = Array.from({ length: 12 }, () => page(4096));
    expect(shouldBuildKtx2(twelve)).toBe(false);
    expect(shouldBuildKtx2(twelve, 'auto', 300 * 1024 * 1024)).toBe(true);
    expect(shouldBuildKtx2(twelve, 'always')).toBe(true);
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
