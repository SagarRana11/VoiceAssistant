import fs from 'fs';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse');
import { KnowledgeDoc } from './knowledgeSources/exerciseKnowledge';

/**
 * Loads a PDF file from the knowledgeSources directory,
 * extracts text, splits by section headings, and returns KnowledgeDoc[].
 */
export async function loadPdfAsKnowledgeDocs(
  fileName: string,
  categoryPrefix: string,
): Promise<KnowledgeDoc[]> {
  const filePath = path.join(__dirname, 'knowledgeSources', fileName);
  const buffer = fs.readFileSync(filePath);
  const uint8 = new Uint8Array(buffer);
  const parser = new PDFParse(uint8);
  const result = await parser.getText();
  console.log('result>>>>>', result);
  // Combine text from all pages
  const rawText: string = result.pages.map((p: { text: string }) => p.text).join('\n');
  console.log('rawText>>>>>>', rawText);
  // Split on top-level numbered section headings like "1. Title" through "8. Title"
  // Uses newline anchor to avoid matching sub-items like "- 3. Map the Movements..."
  const sectionRegex = /(?=\n\d+\.\s+[A-Z])/;
  const rawSections = rawText.split(sectionRegex).filter((s: string) => s.trim().length > 0);
  console.log('rawSessions>>>>>>', rawSections);
  const docs: KnowledgeDoc[] = [];

  for (let i = 0; i < rawSections.length; i++) {
    const section = rawSections[i].trim();
    console.log('section>>>>', section);
    // Extract heading (first line) and body (rest)
    const lines: string[] = section.split('\n').filter((l: string) => l.trim().length > 0);
    if (lines.length === 0) continue;

    const title = lines[0].replace(/^\d+\.\s*/, '').trim();
    console.log('title?>>>', title);
    const content = lines.slice(1).join('\n').trim();
    console.log('content>>>>', content);

    if (!content) continue;

    // Auto-generate tags from title words (lowercase, skip short words)
    const tags: string[] = title
      .toLowerCase()
      .split(/[\s:,()]+/)
      .filter((w: string) => w.length > 3)
      .map((w: string) => w.replace(/[^a-z0-9_]/g, ''))
      .filter(Boolean);

    docs.push({
      id: `${categoryPrefix}_pdf_${String(i + 1).padStart(3, '0')}`,
      category: categoryPrefix,
      title,
      content,
      tags: [...new Set(tags)],
    });
  }

  console.log(`[PdfLoader] Loaded ${docs.length} docs from ${fileName}`);
  return docs;
}
