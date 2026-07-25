/** Thrown by the engine for query types that are declared but not implemented. */
export class UnsupportedQueryError extends Error {
    constructor(type) {
        super(`query type '${type}' is not implemented: morphology is not ingested yet`);
        this.name = 'UnsupportedQueryError';
    }
}
//# sourceMappingURL=types.js.map