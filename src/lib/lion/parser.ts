export type TokenType = 'IDENTIFIER' | 'STRING' | 'NUMBER' | 'PUNCTUATION' | 'KEYWORD' | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

const KEYWORDS = new Set(['run']);

export class Lexer {
  private pos = 0;
  private line = 1;
  private col = 1;

  constructor(private input: string) {}

  private advance(): string {
    const char = this.input[this.pos++];
    if (char === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return char;
  }

  private peek(): string {
    return this.input[this.pos] || '';
  }

  public nextToken(): Token {
    while (this.pos < this.input.length) {
      const char = this.peek();

      if (/\s/.test(char)) {
        this.advance();
        continue;
      }

      if (char === '/' && this.input[this.pos + 1] === '/') {
        while (this.pos < this.input.length && this.peek() !== '\n') {
          this.advance();
        }
        continue;
      }

      const startLine = this.line;
      const startCol = this.col;

      if (/[a-zA-Z_]/.test(char)) {
        let value = '';
        while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.peek())) {
          value += this.advance();
        }
        return { type: KEYWORDS.has(value) ? 'KEYWORD' : 'IDENTIFIER', value, line: startLine, col: startCol };
      }

      if (/[0-9]/.test(char) || (char === '-' && /[0-9]/.test(this.input[this.pos + 1]))) {
        let value = '';
        if (char === '-') value += this.advance();
        while (this.pos < this.input.length && /[0-9.]/.test(this.peek())) {
          value += this.advance();
        }
        return { type: 'NUMBER', value, line: startLine, col: startCol };
      }

      if (char === '"') {
        this.advance(); // skip quote
        let value = '';
        while (this.pos < this.input.length && this.peek() !== '"') {
          value += this.advance();
        }
        if (this.peek() === '"') this.advance();
        return { type: 'STRING', value, line: startLine, col: startCol };
      }

      if ('().{}[],:'.includes(char)) {
        return { type: 'PUNCTUATION', value: this.advance(), line: startLine, col: startCol };
      }

      throw new Error(`Unexpected character '${char}' at line ${startLine}, col ${startCol}`);
    }

    return { type: 'EOF', value: '', line: this.line, col: this.col };
  }
}

export interface ASTNode { type: string; }
export interface Program extends ASTNode { type: 'Program'; body: Statement[]; }
export type Statement = MethodCall | RunStatement;
export interface RunStatement extends ASTNode { type: 'RunStatement'; target: string; arguments: Argument[]; }
export interface MethodCall extends ASTNode { type: 'MethodCall'; object?: string; method: string; arguments: Argument[]; block?: Block; }
export interface Block extends ASTNode { type: 'Block'; statements: Statement[]; }
export interface Argument extends ASTNode { type: 'Argument'; name?: string; value: Expression; }
export type Expression = StringLiteral | NumberLiteral | ArrayLiteral | MethodCall | Identifier;
export interface StringLiteral extends ASTNode { type: 'StringLiteral'; value: string; }
export interface NumberLiteral extends ASTNode { type: 'NumberLiteral'; value: number; }
export interface ArrayLiteral extends ASTNode { type: 'ArrayLiteral'; elements: Expression[]; }
export interface Identifier extends ASTNode { type: 'Identifier'; name: string; }

export class Parser {
  private lexer: Lexer;
  private currentToken!: Token;

  constructor(input: string) {
    this.lexer = new Lexer(input);
    this.advance();
  }

  private advance() {
    this.currentToken = this.lexer.nextToken();
  }

  private eat(type: TokenType, value?: string) {
    if (this.currentToken.type === type && (!value || this.currentToken.value === value)) {
      this.advance();
    } else {
      throw new Error(`Expected ${type}${value ? ` '${value}'` : ''} but got ${this.currentToken.type} '${this.currentToken.value}' at line ${this.currentToken.line}, col ${this.currentToken.col}`);
    }
  }

  public parse(): Program {
    const body: Statement[] = [];
    while (this.currentToken.type !== 'EOF') {
      body.push(this.parseStatement());
    }
    return { type: 'Program', body };
  }

  private parseStatement(): Statement {
    if (this.currentToken.type === 'KEYWORD' && this.currentToken.value === 'run') {
      this.advance();
      const target = this.currentToken.value;
      this.eat('IDENTIFIER');
      this.eat('PUNCTUATION', '(');
      const args = this.parseArguments();
      this.eat('PUNCTUATION', ')');
      return { type: 'RunStatement', target, arguments: args };
    } else {
      return this.parseMethodCall();
    }
  }

  private parseMethodCall(): MethodCall {
    let objectOrMethod = this.currentToken.value;
    this.eat('IDENTIFIER');
    
    let object: string | undefined;
    let method: string;
    
    if (this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '.') {
      this.advance();
      object = objectOrMethod;
      method = this.currentToken.value;
      this.eat('IDENTIFIER');
    } else {
      method = objectOrMethod;
    }

    let args: Argument[] = [];
    if (this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '(') {
      this.advance();
      args = this.parseArguments();
      this.eat('PUNCTUATION', ')');
    }

    let block: Block | undefined;
    if (this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '{') {
      this.advance();
      const statements: Statement[] = [];
      while ((this.currentToken.type as string) !== 'EOF' && (this.currentToken.value as string) !== '}') {
        statements.push(this.parseStatement());
      }
      this.eat('PUNCTUATION', '}');
      block = { type: 'Block', statements };
    }

    return { type: 'MethodCall', object, method, arguments: args, block };
  }

  private parseArguments(): Argument[] {
    const args: Argument[] = [];
    while ((this.currentToken.type as string) !== 'EOF' && (this.currentToken.value as string) !== ')') {
      let name: string | undefined;
      let value: Expression;
      
      const expr = this.parseExpression();
      if (expr.type === 'Identifier' && this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ':') {
        this.advance();
        name = expr.name;
        value = this.parseExpression();
      } else {
        value = expr;
      }

      args.push({ type: 'Argument', name, value });

      if (this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === ',') {
        this.advance();
      }
    }
    return args;
  }

  private parseExpression(): Expression {
    if (this.currentToken.type === 'STRING') {
      const value = this.currentToken.value;
      this.advance();
      return { type: 'StringLiteral', value };
    }
    if (this.currentToken.type === 'NUMBER') {
      const value = parseFloat(this.currentToken.value);
      this.advance();
      return { type: 'NumberLiteral', value };
    }
    if (this.currentToken.type === 'PUNCTUATION' && this.currentToken.value === '[') {
      this.advance();
      const elements: Expression[] = [];
      while ((this.currentToken.type as string) !== 'EOF' && (this.currentToken.value as string) !== ']') {
        elements.push(this.parseExpression());
        if (this.currentToken.type === 'PUNCTUATION' && (this.currentToken.value as string) === ',') {
          this.advance();
        }
      }
      this.eat('PUNCTUATION', ']');
      return { type: 'ArrayLiteral', elements };
    }
    
    if (this.currentToken.type === 'IDENTIFIER') {
      const methodCall = this.parseMethodCall();
      if (!methodCall.object && methodCall.arguments.length === 0 && !methodCall.block) {
        return { type: 'Identifier', name: methodCall.method };
      }
      return methodCall;
    }

    throw new Error(`Unexpected token in expression: ${this.currentToken.type} '${this.currentToken.value}' at line ${this.currentToken.line}, col ${this.currentToken.col}`);
  }
}
