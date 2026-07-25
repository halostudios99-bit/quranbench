import { parseReference } from './reference.js';
import type { Query, ParseError, ParseResult, Scope } from './types.js';

// A small recursive-descent parser turning a query string into a typed Query
// tree. Grammar (lowest precedence first):
//
//   expr    := or
//   or      := and (OR and)*
//   and     := not (AND not)*
//   not     := NOT not | prox
//   prox    := primary ((NEAR/n | FOLLOWED_BY) primary)?
//   primary := '(' expr ')' | quoted | word
//
// A word is classified into a fielded term (pattern:, normalised:, surah:, …),
// a verse reference (2:43), or a bare normalised term. Parse errors carry the
// offset at which they were detected; parseQuery never throws.

type Lexeme =
  | { kind: 'lparen'; pos: number }
  | { kind: 'rparen'; pos: number }
  | { kind: 'and'; pos: number }
  | { kind: 'or'; pos: number }
  | { kind: 'not'; pos: number }
  | { kind: 'followed_by'; pos: number }
  | { kind: 'near'; distance: number; pos: number }
  | { kind: 'quoted'; value: string; pos: number }
  | { kind: 'word'; value: string; pos: number };

class ParseFailure {
  constructor(public error: ParseError) {}
}

function fail(message: string, position: number): never {
  throw new ParseFailure({ message, position });
}

const KNOWN_FIELDS = new Set([
  'pattern',
  'normalised',
  'normalized',
  'exact',
  'prefix',
  'suffix',
  'surah',
  'segment',
  'root',
  'lemma',
  'pos',
]);

function isBoundary(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '(' || ch === ')' || ch === '"';
}

function lex(input: string): Lexeme[] {
  const out: Lexeme[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    if (ch === '(') {
      out.push({ kind: 'lparen', pos: i });
      i++;
      continue;
    }
    if (ch === ')') {
      out.push({ kind: 'rparen', pos: i });
      i++;
      continue;
    }
    if (ch === '"') {
      const start = i;
      i++;
      let value = '';
      while (i < input.length && input[i] !== '"') {
        value += input[i];
        i++;
      }
      if (i >= input.length) fail('unterminated quoted string', start);
      i++; // closing quote
      out.push({ kind: 'quoted', value, pos: start });
      continue;
    }
    const start = i;
    while (i < input.length && !isBoundary(input[i]!)) i++;
    const raw = input.slice(start, i);
    const upper = raw.toUpperCase();
    if (upper === 'AND') out.push({ kind: 'and', pos: start });
    else if (upper === 'OR') out.push({ kind: 'or', pos: start });
    else if (upper === 'NOT') out.push({ kind: 'not', pos: start });
    else if (upper === 'FOLLOWED_BY') out.push({ kind: 'followed_by', pos: start });
    else if (upper.startsWith('NEAR/')) {
      const rest = raw.slice(5);
      if (!/^\d+$/.test(rest)) fail(`malformed NEAR operator '${raw}' (expected NEAR/<number>)`, start);
      out.push({ kind: 'near', distance: Number(rest), pos: start });
    } else {
      out.push({ kind: 'word', value: raw, pos: start });
    }
  }
  return out;
}

function classifyWord(value: string, pos: number): Query {
  const colon = value.indexOf(':');
  if (colon !== -1) {
    const field = value.slice(0, colon).toLowerCase();
    const rest = value.slice(colon + 1);
    if (KNOWN_FIELDS.has(field)) {
      if (rest === '') fail(`empty value for '${field}:'`, pos);
      switch (field) {
        case 'pattern':
          return { type: 'pattern', pattern: rest };
        case 'normalised':
        case 'normalized':
          return { type: 'normalised', text: rest };
        case 'exact':
          return { type: 'exact', text: rest };
        case 'prefix':
          return { type: 'prefix', text: rest };
        case 'suffix':
          return { type: 'suffix', text: rest };
        case 'surah':
          return { type: 'scoped', scope: parseSurahScope(rest, pos), query: { type: 'all' } };
        case 'segment':
          return { type: 'scoped', scope: parseSegmentScope(rest, pos), query: { type: 'all' } };
        case 'root':
          return { type: 'root', root: rest };
        case 'lemma':
          return { type: 'lemma', lemma: rest };
        case 'pos':
          return { type: 'pos', pos: rest };
      }
    }
  }
  // Not a known field. A verse reference, else a bare normalised term.
  if (parseReference(value)) return { type: 'reference', ref: value };
  if (colon !== -1) {
    fail(`unknown field or malformed reference '${value}'`, pos);
  }
  return { type: 'normalised', text: value };
}

function parseSurahScope(rest: string, pos: number): Scope {
  const surahs: number[] = [];
  for (const part of rest.split(',')) {
    const trimmed = part.trim();
    if (!/^\d+$/.test(trimmed)) fail(`invalid surah number '${part}' in scope`, pos);
    const n = Number(trimmed);
    if (n < 1 || n > 114) fail(`surah number ${n} out of range (1–114)`, pos);
    surahs.push(n);
  }
  return { surahs };
}

function parseSegmentScope(rest: string, pos: number): Scope {
  const m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(rest);
  if (!m) fail(`malformed segment scope '${rest}' (expected surah:from[-to])`, pos);
  const surah = Number(m[1]);
  const from = Number(m[2]);
  const to = m[3] === undefined ? from : Number(m[3]);
  if (to < from) fail(`segment scope '${rest}' has to < from`, pos);
  return { segmentRange: { surah, from, to } };
}

class Parser {
  private p = 0;
  constructor(private readonly lexemes: Lexeme[]) {}

  private peek(): Lexeme | undefined {
    return this.lexemes[this.p];
  }
  private next(): Lexeme {
    return this.lexemes[this.p++]!;
  }
  private atEnd(): boolean {
    return this.p >= this.lexemes.length;
  }
  /** Position to report for an error at the current cursor. */
  private here(): number {
    const cur = this.peek();
    if (cur) return cur.pos;
    const last = this.lexemes[this.lexemes.length - 1];
    return last ? last.pos : 0;
  }

  parse(): Query {
    if (this.lexemes.length === 0) fail('empty query', 0);
    const query = this.parseOr();
    if (!this.atEnd()) fail('unexpected token; expected end of query', this.here());
    return query;
  }

  private parseOr(): Query {
    const clauses = [this.parseAnd()];
    while (this.peek()?.kind === 'or') {
      this.next();
      clauses.push(this.parseAnd());
    }
    return clauses.length === 1 ? clauses[0]! : { type: 'or', clauses };
  }

  private parseAnd(): Query {
    const clauses = [this.parseNot()];
    while (this.peek()?.kind === 'and') {
      this.next();
      clauses.push(this.parseNot());
    }
    return clauses.length === 1 ? clauses[0]! : { type: 'and', clauses };
  }

  private parseNot(): Query {
    if (this.peek()?.kind === 'not') {
      this.next();
      return { type: 'not', clause: this.parseNot() };
    }
    return this.parseProx();
  }

  private parseProx(): Query {
    const left = this.parsePrimary();
    const op = this.peek();
    if (op?.kind === 'near') {
      this.next();
      return { type: 'proximity', left, right: this.parsePrimary(), distance: op.distance };
    }
    if (op?.kind === 'followed_by') {
      this.next();
      return { type: 'adjacency', left, right: this.parsePrimary() };
    }
    return left;
  }

  private parsePrimary(): Query {
    const lex = this.peek();
    if (!lex) fail('unexpected end of query; expected a term', this.here());
    switch (lex.kind) {
      case 'lparen': {
        this.next();
        const inner = this.parseOr();
        const close = this.peek();
        if (close?.kind !== 'rparen') fail("expected ')'", this.here());
        this.next();
        return inner;
      }
      case 'quoted': {
        this.next();
        if (lex.value === '') fail('empty quoted term', lex.pos);
        return { type: 'exact', text: lex.value };
      }
      case 'word':
        this.next();
        return classifyWord(lex.value, lex.pos);
      case 'rparen':
        return fail("unexpected ')'", lex.pos);
      default:
        return fail(`expected a term but found operator`, lex.pos);
    }
  }
}

/** Parse a query string into a typed tree. Returns a typed error, never throws. */
export function parseQuery(input: string): ParseResult {
  try {
    const lexemes = lex(input);
    const query = new Parser(lexemes).parse();
    return { ok: true, query };
  } catch (e) {
    if (e instanceof ParseFailure) return { ok: false, error: e.error };
    throw e;
  }
}
