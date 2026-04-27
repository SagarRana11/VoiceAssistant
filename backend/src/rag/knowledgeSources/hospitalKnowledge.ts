import fs from 'fs';
import path from 'path';
import { KnowledgeDoc } from './exerciseKnowledge';

const KB_ROOT = path.join(__dirname, '../../../kb');

const CATEGORY_MAP: Record<string, { dir: string; tags: string[] }> = {
  disease:   { dir: 'disease',   tags: ['disease', 'diagnosis', 'condition', 'heart_attack', 'cardiac'] },
  consent:   { dir: 'consent',   tags: ['consent', 'risks', 'benefits', 'patient_rights', 'informed'] },
  procedure: { dir: 'procedure', tags: ['procedure', 'surgery', 'angiography', 'pci', 'angioplasty', 'stent', 'cabg'] },
  discharge: { dir: 'discharge', tags: ['discharge', 'recovery', 'home_care', 'precautions', 'activity'] },
  medicine:  { dir: 'medicine',  tags: ['medicine', 'medication', 'drugs', 'tablet', 'aspirin', 'blood_thinner'] },
  hospital:  { dir: 'hospital',  tags: ['hospital', 'process', 'ward', 'icu', 'cath_lab', 'team'] },
};

function readKbFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function slugToDocId(category: string, filename: string): string {
  return `hosp_${category}_${filename.replace(/\.[^.]+$/, '').toLowerCase()}`;
}

function titleFromFilename(category: string, filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
  return `${categoryLabel}: ${base.toUpperCase()}`;
}

export function loadHospitalKnowledgeDocs(): KnowledgeDoc[] {
  const docs: KnowledgeDoc[] = [];

  for (const [category, { dir, tags }] of Object.entries(CATEGORY_MAP)) {
    const categoryDir = path.join(KB_ROOT, dir);

    if (!fs.existsSync(categoryDir)) continue;

    const files = fs.readdirSync(categoryDir).filter(f => f.endsWith('.md') || f.endsWith('.txt'));

    for (const file of files) {
      const content = readKbFile(path.join(categoryDir, file));
      if (!content.trim()) continue;

      // Extract diagnosis name from filename for additional tags
      const diagnosisTag = file.replace(/\.[^.]+$/, '').toLowerCase();

      docs.push({
        id:       slugToDocId(category, file),
        category,
        title:    titleFromFilename(category, file),
        content:  content.trim(),
        tags:     [...tags, diagnosisTag, 'hospital_kb'],
      });
    }
  }

  return docs;
}
