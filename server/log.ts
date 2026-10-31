const C = {
  dim: "\x1b[2m",
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
};

function stamp(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${C.dim}${hh}:${mm}:${ss}.${ms}${C.reset}`;
}

function fmt(tag: string, color: string, ...parts: unknown[]): string {
  const t = `${color}[${tag.padEnd(6)}]${C.reset}`;
  return `${stamp()} ${t} ${parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(" ")}`;
}

export const log = {
  info:   (...a: unknown[]) => console.log(fmt("INFO",   C.blue,    ...a)),
  conn:   (...a: unknown[]) => console.log(fmt("CONN",   C.cyan,    ...a)),
  recv:   (...a: unknown[]) => console.log(fmt("RECV",   C.magenta, ...a)),
  route:  (...a: unknown[]) => console.log(fmt("ROUTE",  C.yellow,  ...a)),
  tool:   (...a: unknown[]) => console.log(fmt("TOOL",   C.yellow,  ...a)),
  decide: (...a: unknown[]) => console.log(fmt("DECIDE", C.magenta, ...a)),
  stream: (...a: unknown[]) => console.log(fmt("STREAM", C.dim,     ...a)),
  done:   (...a: unknown[]) => console.log(fmt("DONE",   C.green,   ...a)),
  err:    (...a: unknown[]) => console.log(fmt("ERR",    C.red,     ...a)),
};
