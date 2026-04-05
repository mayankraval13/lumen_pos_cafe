const productImageModules = import.meta.glob<string>('../assets/products/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

function stemFromGlobPath(path: string): string {
  const m = path.match(/\/([^/]+)\.png$/i);
  return m ? m[1].toLowerCase() : '';
}

const imageUrlByStem: Record<string, string> = {};
for (const [path, url] of Object.entries(productImageModules)) {
  const stem = stemFromGlobPath(path);
  if (stem) imageUrlByStem[stem] = url;
}

function nameToImageStem(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}

/** Prefer API image when set; otherwise match `src/assets/products/{normalized_name}.png`. */
export function resolveRegisterProductImage(
  productName: string,
  imageUrlFromApi?: string | null,
): string | undefined {
  const fromApi = imageUrlFromApi?.trim();
  if (fromApi) return fromApi;
  const stem = nameToImageStem(productName);
  return imageUrlByStem[stem];
}
