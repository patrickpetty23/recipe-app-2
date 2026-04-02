import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { logger } from '../utils/logger';

export async function parsePdf(fileUri) {
  logger.info('fileParser.parsePdf', { fileUri });
  try {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: 'base64',
    });
    const binary = atob(base64);
    const text = extractPdfText(binary);
    if (text.length < 20) {
      throw new Error(
        'This PDF uses a format that makes text extraction difficult. ' +
        'Try one of these instead:\n' +
        '• Take a photo of each page with the camera\n' +
        '• Copy-paste the recipe text and use the URL/text import'
      );
    }
    logger.info('fileParser.parsePdf.success', { fileUri, textLength: text.length });
    return text;
  } catch (err) {
    logger.error('fileParser.parsePdf.error', { fileUri, error: err.message });
    throw err;
  }
}

export async function parseDocx(fileUri) {
  logger.info('fileParser.parseDocx', { fileUri });
  try {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: 'base64',
    });
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const zip = await JSZip.loadAsync(bytes);
    const docXml = await zip.file('word/document.xml')?.async('string');
    if (!docXml) {
      throw new Error('Invalid DOCX file: missing word/document.xml');
    }
    const text = docXml
      .replace(/<w:br[^>]*\/>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length < 20) {
      throw new Error('Could not extract enough text from DOCX. Try scanning with the camera instead.');
    }
    logger.info('fileParser.parseDocx.success', { fileUri, textLength: text.length });
    return text;
  } catch (err) {
    logger.error('fileParser.parseDocx.error', { fileUri, error: err.message });
    throw err;
  }
}

function extractPdfText(binary) {
  const textParts = [];

  const parenRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
  let match;
  while ((match = parenRegex.exec(binary)) !== null) {
    const raw = match[1]
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')');
    if (/[a-zA-Z]{2,}/.test(raw)) {
      textParts.push(raw);
    }
  }

  if (textParts.length < 5) {
    const tjArrayRegex = /\[((?:\([^)]*\)|<[^>]*>|[\s\d.-])*)\]\s*TJ/g;
    while ((match = tjArrayRegex.exec(binary)) !== null) {
      const inner = match[1];
      const strParts = [];
      const innerParen = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
      let m2;
      while ((m2 = innerParen.exec(inner)) !== null) {
        strParts.push(m2[1]);
      }
      const combined = strParts.join('');
      if (/[a-zA-Z]{2,}/.test(combined)) {
        textParts.push(combined);
      }
    }
  }

  return textParts.join(' ').replace(/\s+/g, ' ').trim();
}
