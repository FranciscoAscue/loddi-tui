import {z} from 'zod';

export const bookSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  author: z.array(z.string().min(1)).default([]),
  language: z.string().default('es'),
  cover: z.object({
    document: z.string().default('cover/cover.md'),
    image: z.string().optional(),
  }).default({document: 'cover/cover.md'}),
  content: z.array(z.string()).default([]),
  bibliography: z.string().default('bibliography/references.bib'),
  citationStyle: z.string().optional(),
  output: z.object({
    directory: z.string().default('build'),
    tableOfContents: z.boolean().default(true),
    numberedSections: z.boolean().default(true),
    pdfEngine: z.string().default('typst'),
    mainFont: z.string().min(1).optional(),
    epubVersion: z.number().int().min(2).max(3).default(3),
  }).default({
    directory: 'build',
    tableOfContents: true,
    numberedSections: true,
    pdfEngine: 'typst',
    epubVersion: 3,
  }),
});

export type Book = z.infer<typeof bookSchema>;

export function createDefaultBook(title: string): Book {
  return bookSchema.parse({title});
}
