import { foldTurkish } from './text.ts'

// Arithmetic is done here, not by the model: small models get multiplication wrong.

const OPERATOR_WORDS: [RegExp, string][] = [
  [/(carpi|kere|times|multiplied by|умножить на|умножить|×|\bx\b)/gu, '*'],
  [/(bolu|divided by|разделить на|делить на|÷)/gu, '/'],
  [/(arti|plus|плюс)/gu, '+'],
  [/(eksi|minus|минус)/gu, '-'],
]

// Words allowed around an expression ("12 çarpı 7 kaç eder?"); anything else
// means the message is not simply a calculation.
const FILLER = new Set([
  'kac', 'eder', 'yapar', 'nedir', 'ne', 'sonuc', 'sonucu', 'hesapla', 'hesaplar', 'misin', 'mi', 'lutfen', 'bana',
  'what', 'is', 'whats', 'calculate', 'compute', 'please', 'equals',
  'сколько', 'будет', 'посчитай', 'вычисли', 'равно', 'пожалуйста',
])

export interface Calculation {
  expression: string
  value: number
}

export function evaluateMath(text: string): Calculation | null {
  let s = foldTurkish(text)
  for (const [re, op] of OPERATOR_WORDS) s = s.replace(re, ` ${op} `)
  // decimal comma (2,5) → dot, but keep thousands as written
  s = s.replace(/(\d),(\d)/g, '$1.$2')

  const match = s.match(/[\d.]+(?:\s*[-+*/^]\s*\(?\s*[\d.]+\s*\)?)+|\(\s*[\d.]+(?:\s*[-+*/^]\s*[\d.]+)+\s*\)(?:\s*[-+*/^]\s*[\d.]+)*/)
  if (!match) return null
  const rest = (s.slice(0, match.index) + ' ' + s.slice((match.index ?? 0) + match[0].length))
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
  if (rest.some((w) => !FILLER.has(w))) return null

  const value = evaluate(match[0])
  if (value === null || !Number.isFinite(value)) return null
  return { expression: match[0].replace(/\s+/g, ' ').trim(), value }
}

// Shunting-yard evaluation of + - * / ^ and parentheses; no eval().
function evaluate(expression: string): number | null {
  const tokens = expression.match(/\d+(?:\.\d+)?|[-+*/^()]/g)
  if (!tokens) return null
  const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 }
  const output: (number | string)[] = []
  const ops: string[] = []
  for (const t of tokens) {
    if (/\d/.test(t)) output.push(Number(t))
    else if (t === '(') ops.push(t)
    else if (t === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') output.push(ops.pop()!)
      if (ops.pop() !== '(') return null
    } else {
      while (ops.length && ops[ops.length - 1] !== '(' && (prec[ops[ops.length - 1]] > prec[t] || (prec[ops[ops.length - 1]] === prec[t] && t !== '^'))) {
        output.push(ops.pop()!)
      }
      ops.push(t)
    }
  }
  while (ops.length) {
    const op = ops.pop()!
    if (op === '(') return null
    output.push(op)
  }
  const stack: number[] = []
  for (const t of output) {
    if (typeof t === 'number') stack.push(t)
    else {
      const b = stack.pop()
      const a = stack.pop()
      if (a === undefined || b === undefined) return null
      stack.push(t === '+' ? a + b : t === '-' ? a - b : t === '*' ? a * b : t === '/' ? a / b : a ** b)
    }
  }
  return stack.length === 1 ? stack[0] : null
}
