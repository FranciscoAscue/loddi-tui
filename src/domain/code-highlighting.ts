export interface HighlightSpan {
  text: string;
  color?: 'white' | 'gray' | 'cyan' | 'yellow' | 'green' | 'magenta' | 'blue';
  bold?: boolean;
}

const keywordGroups: Record<string, string> = {
  js: 'const let var function async await return if else for while do switch case break continue class extends new import export default try catch finally throw typeof instanceof interface type enum implements public private protected static readonly get set yield',
  c: 'include define typedef struct enum union static const int char float double void return if else for while switch case break continue sizeof',
  cpp: 'auto using namespace template class struct public private protected virtual override const constexpr static return if else for while new delete try catch throw',
  java: 'public private protected static final class interface extends implements void int boolean double return if else for while new try catch throw package import',
  csharp: 'using namespace class public private protected static readonly async await var return if else for foreach new try catch throw',
  python: 'def class async await return if elif else for while in is not and or import from as with try except finally raise pass yield lambda global nonlocal',
  ruby: 'def class module end if elsif else unless while do begin rescue ensure require include return yield',
  rust: 'fn let mut pub use mod struct enum impl trait match if else for while loop return async await move crate self super where const static type',
  go: 'package import func var const type struct interface map chan return if else for range switch case select go defer fallthrough break continue',
  shell: 'if then elif else fi for while until do done function case esac in export local readonly source return',
  json: '',
  yaml: '',
  css: 'import media supports keyframes important',
  html: '',
  sql: 'select from where join inner left right outer on group by order having limit insert into values update set delete create table alter drop as distinct null is and or not union with returning',
  mermaid: 'graph flowchart sequenceDiagram classDiagram stateDiagram erDiagram gantt pie subgraph end participant actor note loop alt else opt par rect direction',
  latex: 'begin end documentclass usepackage section subsection textbf emph frac sqrt sum int label ref cite',
};

const valueWords = new Set('true false null undefined none True False None nil self this super'.split(' '));
const typeWords = new Set('string number boolean bigint void any unknown never int float bool str list dict tuple usize i32 u32 i64 u64 f32 f64 String Result Option error'.split(' '));

export function normalizeCodeLanguage(raw?: string): string {
  const name = (raw ?? '').trim().replace(/^\{\.?/, '').replace(/\}$/, '').split(/[\s,]/, 1)[0]?.toLowerCase() ?? '';
  if (['js', 'javascript', 'jsx', 'mjs', 'cjs', 'ts', 'typescript', 'tsx'].includes(name)) return 'js';
  if (['c', 'h'].includes(name)) return 'c';
  if (['cpp', 'c++', 'cxx', 'hpp', 'h++'].includes(name)) return 'cpp';
  if (name === 'java') return 'java';
  if (['cs', 'c#', 'csharp'].includes(name)) return 'csharp';
  if (['py', 'python'].includes(name)) return 'python';
  if (['rb', 'ruby'].includes(name)) return 'ruby';
  if (['rs', 'rust'].includes(name)) return 'rust';
  if (['go', 'golang'].includes(name)) return 'go';
  if (['sh', 'bash', 'zsh', 'shell', 'fish'].includes(name)) return 'shell';
  if (['json', 'jsonc'].includes(name)) return 'json';
  if (['yml', 'yaml'].includes(name)) return 'yaml';
  if (['css', 'scss', 'sass'].includes(name)) return 'css';
  if (['html', 'xml', 'svg'].includes(name)) return 'html';
  if (['sql', 'postgresql', 'mysql', 'sqlite'].includes(name)) return 'sql';
  if (name === 'mermaid') return 'mermaid';
  if (['tex', 'latex'].includes(name)) return 'latex';
  return 'text';
}

export function highlightCodeLine(line: string, rawLanguage?: string): HighlightSpan[] {
  const language = normalizeCodeLanguage(rawLanguage);
  const keywords = new Set((keywordGroups[language] ?? '').split(' ').filter(Boolean));
  const spans: HighlightSpan[] = [];
  const add = (text: string, color?: HighlightSpan['color'], bold?: boolean) => {
    if (!text) return;
    const previous = spans.at(-1);
    if (previous && previous.color === color && Boolean(previous.bold) === Boolean(bold)) previous.text += text;
    else spans.push({text, ...(color ? {color} : {}), ...(bold ? {bold} : {})});
  };
  let index = 0;
  while (index < line.length) {
    const rest = line.slice(index);
    const comment = language === 'shell' || language === 'python' || language === 'ruby' || language === 'yaml' ? '#'
      : language === 'sql' ? '--' : language === 'latex' ? '%' : language === 'html' ? '<!--' : '//';
    if (rest.startsWith(comment) && (language !== 'shell' || index === 0 || /\s/.test(line[index - 1]!))) {
      add(rest, 'gray');
      break;
    }
    if (['js', 'c', 'cpp', 'java', 'csharp', 'rust', 'go', 'css', 'text'].includes(language) && rest.startsWith('/*')) {
      const end = rest.indexOf('*/', 2);
      const token = end < 0 ? rest : rest.slice(0, end + 2);
      add(token, 'gray');
      index += token.length;
      continue;
    }
    const char = line[index]!;
    if (char === '"' || char === "'" || (char === '`' && language === 'js')) {
      let end = index + 1;
      while (end < line.length) {
        if (line[end] === '\\') { end += 2; continue; }
        if (line[end] === char) { end += 1; break; }
        end += 1;
      }
      const token = line.slice(index, end);
      const isKey = (language === 'json' || language === 'yaml') && /^\s*:/.test(line.slice(end));
      add(token, isKey ? 'cyan' : 'green');
      index = end;
      continue;
    }
    if (language === 'latex' && char === '\\') {
      const command = rest.match(/^\\[A-Za-z@]+/);
      if (command) { add(command[0], 'magenta', true); index += command[0].length; continue; }
    }
    if (language === 'html' && char === '<') {
      const tag = rest.match(/^<\/?[A-Za-z][\w:-]*/);
      if (tag) { add(tag[0], 'magenta', true); index += tag[0].length; continue; }
    }
    const number = rest.match(/^\b\d+(?:\.\d+)?\b/);
    if (number) { add(number[0], 'blue'); index += number[0].length; continue; }
    const word = rest.match(/^[A-Za-z_][A-Za-z_0-9]*/);
    if (word) {
      const value = word[0];
      const lower = language === 'sql' ? value.toLowerCase() : value;
      const isKey = (language === 'yaml' || language === 'css') && /^\s*:/.test(line.slice(index + value.length));
      if (keywords.has(lower)) add(value, 'magenta', true);
      else if (valueWords.has(value) || (language === 'sql' && value.toLowerCase() === 'null')) add(value, 'yellow');
      else if (isKey || typeWords.has(value)) add(value, 'cyan');
      else add(value, language === 'text' ? 'green' : undefined);
      index += value.length;
      continue;
    }
    if (language === 'mermaid' && /^(?:-->|---|==>|-.->)/.test(rest)) {
      const arrow = rest.match(/^(?:-->|---|==>|-.->)/)![0];
      add(arrow, 'cyan');
      index += arrow.length;
      continue;
    }
    add(char, language === 'text' ? 'green' : undefined);
    index += 1;
  }
  return spans;
}
