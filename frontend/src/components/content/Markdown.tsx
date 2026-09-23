import type { ReactNode } from "react";

/**
 * Render seguro de Markdown básico (sin dependencias externas).
 * Solo bloque de código, negrita, cursiva, enlaces y saltos.
 * Nunca interpretamos HTML del usuario.
 */
export function Markdown({ source }: { source: string | null | undefined }) {
  if (!source) return null;
  const lines = source.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let key = 0;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        blocks.push(
          <pre
            key={`code-${key++}`}
            className="overflow-x-auto rounded bg-bg p-3 text-sm font-mono"
          >
            {codeBuf.join("\n")}
          </pre>,
        );
        codeBuf = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(
        <h2 key={key++} className="mt-3 text-xl font-bold">
          {inline(line.slice(2))}
        </h2>,
      );
    } else if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={key++} className="mt-2 text-lg font-semibold">
          {inline(line.slice(3))}
        </h3>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push(
        <li key={key++} className="ml-5 list-disc">
          {inline(line.slice(2))}
        </li>,
      );
    } else if (line.trim() === "") {
      blocks.push(<br key={key++} />);
    } else {
      blocks.push(
        <p key={key++} className="my-1">
          {inline(line)}
        </p>,
      );
    }
  }
  if (inCode && codeBuf.length) {
    blocks.push(
      <pre key={`code-${key++}`} className="overflow-x-auto rounded bg-bg p-3 text-sm font-mono">
        {codeBuf.join("\n")}
      </pre>,
    );
  }
  return <div className="prose-sm space-y-1 text-sm">{blocks}</div>;
}

function inline(text: string): ReactNode[] {
  // **negrita**, *cursiva*, `código`, [texto](url)
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={i++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(
        <code key={i++} className="rounded bg-bg px-1">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("[")) {
      const match = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(token);
      if (match) {
        const href = match[2];
        if (href.startsWith("https://") || href.startsWith("http://")) {
          parts.push(
            <a
              key={i++}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              {match[1]}
            </a>,
          );
        } else {
          parts.push(match[1]);
        }
      }
    } else {
      parts.push(<em key={i++}>{token.slice(1, -1)}</em>);
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
