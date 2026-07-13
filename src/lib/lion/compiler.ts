import { Program, Statement, MethodCall, RunStatement, Argument, Expression, ArrayLiteral, StringLiteral, NumberLiteral, Identifier } from './parser';

export const ALL_LANGUAGES = [
  "Python", "JavaScript", "TypeScript", "Rust", "Go", "Java", "Kotlin", "Swift", "C", "C++", 
  "C#", "Ruby", "PHP", "Dart", "Scala", "Haskell", "Elixir", "Erlang", "Lua", "Perl", 
  "R", "Julia", "MATLAB", "Objective-C", "Zig", "Nim", "Crystal", "F#", "OCaml", "Clojure", 
  "Groovy", "Solidity", "Assembly (x86)", "COBOL", "Fortran", "Ada", "Pascal", "Prolog", 
  "Scheme", "Racket", "VB.NET", "Shell/Bash", "PowerShell", "SQL", "WebAssembly Text (WAT)"
];

export class LionCompiler {
  public compile(ast: Program, target: string): string {
    const t = target.toLowerCase();
    switch (t) {
      case 'python': return this.compilePython(ast);
      case 'rust': return this.compileRust(ast);
      case 'javascript':
      case 'typescript':
      case 'js':
      case 'ts':
         return this.compileJS(ast);
      default:
         return this.compileFallback(ast, target);
    }
  }

  // --- JavaScript ---
  private compileJS(ast: Program): string {
    let out = `// Compiled to JavaScript\n\n`;
    out += ast.body.map(stmt => this.compileJSStatement(stmt, 0)).join('\n');
    return out;
  }

  private compileJSStatement(stmt: Statement, indent: number): string {
    const ind = '  '.repeat(indent);
    if (stmt.type === 'RunStatement') {
      const args = stmt.arguments.map(a => this.compileJSArg(a)).join(', ');
      return `${ind}await run('${stmt.target}', { ${args} });`;
    } else if (stmt.type === 'MethodCall') {
      const call = stmt as MethodCall;
      const target = call.object ? `${call.object}.${call.method}` : call.method;
      const args = call.arguments.map(a => this.compileJSArg(a)).join(', ');
      
      let out = `${ind}${target}({ ${args} })`;
      if (call.block) {
        out += ` => {\n`;
        out += call.block.statements.map(s => this.compileJSStatement(s, indent + 1)).join('\n');
        out += `\n${ind}}`;
      }
      return out + ';';
    }
    return '';
  }

  private compileJSArg(arg: Argument): string {
    const val = this.compileJSExpr(arg.value);
    return arg.name ? `${arg.name}: ${val}` : val;
  }

  private compileJSExpr(expr: Expression): string {
    if (expr.type === 'StringLiteral') return `"${(expr as StringLiteral).value}"`;
    if (expr.type === 'NumberLiteral') return `${(expr as NumberLiteral).value}`;
    if (expr.type === 'Identifier') return (expr as Identifier).name;
    if (expr.type === 'ArrayLiteral') {
      return `[${(expr as ArrayLiteral).elements.map(e => this.compileJSExpr(e)).join(', ')}]`;
    }
    if (expr.type === 'MethodCall') {
      const call = expr as MethodCall;
      const target = call.object ? `${call.object}.${call.method}` : call.method;
      const args = call.arguments.map(a => this.compileJSArg(a)).join(', ');
      return `${target}({ ${args} })`;
    }
    return '';
  }

  // --- Python ---
  private compilePython(ast: Program): string {
    let out = `# Compiled to Python\n\n`;
    out += ast.body.map(stmt => this.compilePyStatement(stmt, 0)).join('\n');
    return out;
  }

  private compilePyStatement(stmt: Statement, indent: number): string {
    const ind = '    '.repeat(indent);
    if (stmt.type === 'RunStatement') {
      const args = stmt.arguments.map(a => this.compilePyArg(a)).join(', ');
      return `${ind}run('${stmt.target}', ${args})`;
    } else if (stmt.type === 'MethodCall') {
      const call = stmt as MethodCall;
      const target = call.object ? `${call.object}.${call.method}` : call.method;
      const args = call.arguments.map(a => this.compilePyArg(a)).join(', ');
      
      let out = `${ind}${target}(${args})`;
      if (call.block) {
        out += `:\n`;
        out += call.block.statements.map(s => this.compilePyStatement(s, indent + 1)).join('\n');
      }
      return out;
    }
    return '';
  }

  private compilePyArg(arg: Argument): string {
    const val = this.compilePyExpr(arg.value);
    return arg.name ? `${arg.name}=${val}` : val;
  }

  private compilePyExpr(expr: Expression): string {
    if (expr.type === 'StringLiteral') return `"${(expr as StringLiteral).value}"`;
    if (expr.type === 'NumberLiteral') return `${(expr as NumberLiteral).value}`;
    if (expr.type === 'Identifier') return (expr as Identifier).name;
    if (expr.type === 'ArrayLiteral') {
      return `[${(expr as ArrayLiteral).elements.map(e => this.compilePyExpr(e)).join(', ')}]`;
    }
    if (expr.type === 'MethodCall') {
      const call = expr as MethodCall;
      const target = call.object ? `${call.object}.${call.method}` : call.method;
      const args = call.arguments.map(a => this.compilePyArg(a)).join(', ');
      return `${target}(${args})`;
    }
    return '';
  }

  // --- Rust ---
  private compileRust(ast: Program): string {
    let out = `// Compiled to Rust\n\n`;
    out += ast.body.map(stmt => this.compileRustStatement(stmt, 0)).join('\n');
    return out;
  }

  private compileRustStatement(stmt: Statement, indent: number): string {
    const ind = '    '.repeat(indent);
    if (stmt.type === 'RunStatement') {
      const args = stmt.arguments.map(a => this.compileRustArg(a)).join(', ');
      return `${ind}run!("${stmt.target}", ${args});`;
    } else if (stmt.type === 'MethodCall') {
      const call = stmt as MethodCall;
      const target = call.object ? `${call.object}::${call.method}` : call.method;
      const args = call.arguments.map(a => this.compileRustArg(a)).join(', ');
      
      let out = `${ind}${target}(${args})`;
      if (call.block) {
        out += ` {\n`;
        out += call.block.statements.map(s => this.compileRustStatement(s, indent + 1)).join('\n');
        out += `\n${ind}}`;
      } else {
         out += `;`;
      }
      return out;
    }
    return '';
  }

  private compileRustArg(arg: Argument): string {
    const val = this.compileRustExpr(arg.value);
    return val; // Rust doesn't have named args, maybe pass as struct but let's keep it simple
  }

  private compileRustExpr(expr: Expression): string {
    if (expr.type === 'StringLiteral') return `"${(expr as StringLiteral).value}"`;
    if (expr.type === 'NumberLiteral') return `${(expr as NumberLiteral).value}`;
    if (expr.type === 'Identifier') return (expr as Identifier).name;
    if (expr.type === 'ArrayLiteral') {
      return `vec![${(expr as ArrayLiteral).elements.map(e => this.compileRustExpr(e)).join(', ')}]`;
    }
    if (expr.type === 'MethodCall') {
      const call = expr as MethodCall;
      const target = call.object ? `${call.object}::${call.method}` : call.method;
      const args = call.arguments.map(a => this.compileRustArg(a)).join(', ');
      return `${target}(${args})`;
    }
    return '';
  }

  // --- Fallback ---
  private compileFallback(ast: Program, target: string): string {
    let out = `// Compiled to ${target} (Best-effort AST transpilation)\n\n`;
    out += ast.body.map(stmt => this.compileFallbackStatement(stmt, 0)).join('\n');
    return out;
  }

  private compileFallbackStatement(stmt: Statement, indent: number): string {
    const ind = '  '.repeat(indent);
    if (stmt.type === 'RunStatement') {
      const args = stmt.arguments.map(a => this.compileFallbackArg(a)).join(', ');
      return `${ind}run("${stmt.target}", ${args});`;
    } else if (stmt.type === 'MethodCall') {
      const call = stmt as MethodCall;
      const target = call.object ? `${call.object}.${call.method}` : call.method;
      const args = call.arguments.map(a => this.compileFallbackArg(a)).join(', ');
      
      let out = `${ind}${target}(${args})`;
      if (call.block) {
        out += ` {\n`;
        out += call.block.statements.map(s => this.compileFallbackStatement(s, indent + 1)).join('\n');
        out += `\n${ind}}`;
      } else {
        out += `;`;
      }
      return out;
    }
    return '';
  }

  private compileFallbackArg(arg: Argument): string {
    const val = this.compileFallbackExpr(arg.value);
    return arg.name ? `${arg.name}=${val}` : val;
  }

  private compileFallbackExpr(expr: Expression): string {
    if (expr.type === 'StringLiteral') return `"${(expr as StringLiteral).value}"`;
    if (expr.type === 'NumberLiteral') return `${(expr as NumberLiteral).value}`;
    if (expr.type === 'Identifier') return (expr as Identifier).name;
    if (expr.type === 'ArrayLiteral') {
      return `[${(expr as ArrayLiteral).elements.map(e => this.compileFallbackExpr(e)).join(', ')}]`;
    }
    if (expr.type === 'MethodCall') {
      const call = expr as MethodCall;
      const target = call.object ? `${call.object}.${call.method}` : call.method;
      const args = call.arguments.map(a => this.compileFallbackArg(a)).join(', ');
      return `${target}(${args})`;
    }
    return '';
  }
}
