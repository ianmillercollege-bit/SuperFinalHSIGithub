import type { AssistantId } from './types';

// OPT-IN: official logo files for the "Plug into" tiles. Until you set a path, each tile shows a two-letter monogram.
//
// 1) Download each company's OFFICIAL logo from its own brand or press page and read its usage rules first.
//    Each owner can require changes or withdraw permission. Do not redraw, recolor, stretch or add effects to a logo.
// 2) Save the files under public/brand/assistants/ (SVG is best), then set the paths here, for example:
//      claude: '/brand/assistants/claude.svg',
//      chatgpt: '/brand/assistants/chatgpt.svg',
//      gemini: '/brand/assistants/gemini.svg',
// Paths are used as-is in an <img>. A path that fails to load falls back to the monogram, so nothing breaks.
export const ASSISTANT_LOGOS: Partial<Record<AssistantId, string>> = {
  claude: '/brand/assistants/claude.jpg',
  chatgpt: '/brand/assistants/chatgpt.png',
  gemini: '/brand/assistants/gemini.png',
};
