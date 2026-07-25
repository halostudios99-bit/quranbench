import { describe, expect, it } from 'vitest';
import { CORPUS_ARTIFACT_VERSION } from './index.js';

describe('corpus package', () => {
  it('pins the artifact version the pipeline emits', () => {
    expect(CORPUS_ARTIFACT_VERSION).toBe('0.1.0');
  });
});
