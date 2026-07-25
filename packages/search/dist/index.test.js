import { describe, expect, it } from 'vitest';
import { SEARCH_ENGINE_READY } from './index.js';
describe('search package', () => {
    it('has no engine yet (skeleton only)', () => {
        expect(SEARCH_ENGINE_READY).toBe(false);
    });
});
//# sourceMappingURL=index.test.js.map