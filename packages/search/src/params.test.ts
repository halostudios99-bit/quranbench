import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PARAMS,
  parseParams,
  serialiseParams,
  withDefaults,
  type ComputationParams,
} from './params.js';

describe('computation parameters', () => {
  it('serialises defaults to a short stable string', () => {
    expect(serialiseParams(DEFAULT_PARAMS)).toBe(
      'text=tanzil-uthmani;corpus=0.4.0;numbering=kufan;basmala=1;waqf=0;tashkeel=0;norm=normalised',
    );
  });

  it('serialisation is deterministic — identical params, identical string', () => {
    expect(serialiseParams(DEFAULT_PARAMS)).toBe(serialiseParams({ ...DEFAULT_PARAMS }));
  });

  it('round-trips the defaults', () => {
    expect(parseParams(serialiseParams(DEFAULT_PARAMS))).toEqual(DEFAULT_PARAMS);
  });

  it('round-trips a fully non-default parameter set', () => {
    const params: ComputationParams = {
      textEdition: 'tanzil-simple',
      corpusVersion: '9.9.9',
      numberingScheme: 'basran',
      includeBasmala: false,
      includeWaqfMarks: true,
      tashkeelCounted: true,
      normalisationProfile: 'uthmani',
    };
    expect(parseParams(serialiseParams(params))).toEqual(params);
  });

  it('withDefaults applies overrides over the defaults', () => {
    const params = withDefaults({ numberingScheme: 'basran', includeBasmala: false });
    expect(params.numberingScheme).toBe('basran');
    expect(params.includeBasmala).toBe(false);
    expect(params.corpusVersion).toBe(DEFAULT_PARAMS.corpusVersion);
  });

  it('rejects a malformed field', () => {
    expect(() => parseParams('text=tanzil-uthmani;corpus')).toThrow(/malformed field/);
  });

  it('rejects a missing field', () => {
    expect(() => parseParams('text=tanzil-uthmani')).toThrow(/missing field/);
  });

  it('rejects a non-boolean bit', () => {
    const bad = serialiseParams(DEFAULT_PARAMS).replace('basmala=1', 'basmala=yes');
    expect(() => parseParams(bad)).toThrow(/must be 0 or 1/);
  });

  it('rejects an unknown normalisation profile', () => {
    const bad = serialiseParams(DEFAULT_PARAMS).replace('norm=normalised', 'norm=wild');
    expect(() => parseParams(bad)).toThrow(/unknown normalisation profile/);
  });
});
