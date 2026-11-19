import { buildChapterDefinition } from './ChapterDefinitionBuilder.js';
import {
  chapterErrors,
  checkChapterSettings,
  parseChapterSettings
} from './ChapterSettingsSchema.js';
import chapterISettings from './chapter-i.json';

const settings = parseChapterSettings(chapterISettings);
const errors = chapterErrors(checkChapterSettings(settings));
const first = errors[0];
if (first) {
  throw new Error('Chapter I settings: ' + first.message);
}

export const CHAPTER_I = buildChapterDefinition(settings);
