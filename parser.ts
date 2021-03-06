import {parser} from "lezer-python";
import {Tree, TreeCursor} from "lezer-tree";
import {Expr, Stmt, Op} from "./ast";

export function traverseExpr(c : TreeCursor, s : string) : Expr {
  switch(c.type.name) {
    case "Number":
      return {
        tag: "num",
        value: Number(s.substring(c.from, c.to))
      }
    case "VariableName":
      return {
        tag: "id",
        name: s.substring(c.from, c.to)
      }
    case "BinaryExpression":
      c.firstChild();
      const left = traverseExpr(c, s);
      c.nextSibling(); // Here we would look at this value to get the operator
      c.nextSibling();
      const right = traverseExpr(c, s);
      c.parent();
      return {
        tag: "op",
        op: Op.Plus,
        left: left,
        right: right
      }
    default:
      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverseStmt(c : TreeCursor, s : string) : Stmt {
  switch(c.node.type.name) {
    case "AssignStatement":
      c.firstChild(); // go to name
      const name = s.substring(c.from, c.to);
      c.nextSibling(); // go to equals
      c.nextSibling(); // go to value
      const value = traverseExpr(c, s);
      c.parent();
      return {
        tag: "define",
        name: name,
        value: value
      }
    case "ExpressionStatement":
      c.firstChild();
      let childName = c.node.type.name;
      if((childName as any) === "CallExpression") { // Note(Joe): hacking around typescript here; it doesn't know about state
        c.firstChild();
        const callName = s.substring(c.from, c.to);
        if (callName === "globals") {
          c.parent();
          c.parent();
          return {
            tag: "globals"
          };
        } else if (callName === "print") {
          c.nextSibling(); // go to arglist
          c.firstChild(); // go into arglist
          c.nextSibling(); // find single argument in arglist
          const arg = traverseExpr(c, s);
          c.parent(); // pop arglist
          c.parent(); // pop expressionstmt
          return {
            tag: "print",
            // LOL TODO: not this
            value: arg
          };
        }
      }
      else {
        const expr = traverseExpr(c, s);
        c.parent(); // pop going into stmt
        return {
          tag: "expr",
          expr: expr
        }
      }
    default:
      throw new Error("Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverse(c : TreeCursor, s : string) : Array<Stmt> {
  switch(c.node.type.name) {
    case "Script":
      const stmts = [];
      const firstChild = c.firstChild();
      do {
        stmts.push(traverseStmt(c, s));
      } while(c.nextSibling())
      return stmts;
    default:
      throw new Error("Could not parse program at " + c.node.from + " " + c.node.to);
  }
}
export function parse(source : string) : Array<Stmt> {
  const t = parser.parse(source);
  return traverse(t.cursor(), source);
}
