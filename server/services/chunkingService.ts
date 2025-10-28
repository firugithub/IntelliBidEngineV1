/**
 * Smart text chunking service for RAG
 * 
 * Chunks documents into 500-1000 token segments with 100 token overlap
 * for optimal semantic search and retrieval.
 */

interface ChunkResult {
  content: string;
  tokenCount: number;
  metadata?: {
    chunkIndex: number;
    sectionTitle?: string;
    pageNumber?: number;
  };
}

interface ChunkingOptions {
  minTokens?: number; // Default: 500
  maxTokens?: number; // Default: 1000
  overlapTokens?: number; // Default: 100
  sectionTitle?: string;
  pageNumber?: number;
}

/**
 * Approximate token count (rough estimate: 1 token ≈ 4 characters)
 * For production, consider using tiktoken or similar for accurate counts
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into sentences for better chunk boundaries
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence boundaries (., !, ?) followed by whitespace
  const sentences = text.split(/([.!?]+\s+)/);
  const result: string[] = [];
  
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i];
    const delimiter = sentences[i + 1] || "";
    if (sentence.trim()) {
      result.push(sentence + delimiter);
    }
  }
  
  return result;
}

/**
 * Chunk text into segments with overlap
 */
export function chunkText(
  text: string,
  options: ChunkingOptions = {}
): ChunkResult[] {
  const {
    minTokens = 500,
    maxTokens = 1000,
    overlapTokens = 100,
    sectionTitle,
    pageNumber,
  } = options;

  if (!text || text.trim().length === 0) {
    return [];
  }

  const sentences = splitIntoSentences(text);
  const chunks: ChunkResult[] = [];
  let currentChunk: string[] = [];
  let currentTokenCount = 0;
  let chunkIndex = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceTokens = estimateTokenCount(sentence);

    // If adding this sentence would exceed maxTokens and we have enough content
    if (currentTokenCount + sentenceTokens > maxTokens && currentTokenCount >= minTokens) {
      // Save current chunk
      chunks.push({
        content: currentChunk.join("").trim(),
        tokenCount: currentTokenCount,
        metadata: {
          chunkIndex: chunkIndex++,
          sectionTitle,
          pageNumber,
        },
      });

      // Create overlap by keeping the last few sentences
      const overlapSentences: string[] = [];
      let overlapTokenCount = 0;
      
      for (let j = currentChunk.length - 1; j >= 0; j--) {
        const overlapSentence = currentChunk[j];
        const overlapSentenceTokens = estimateTokenCount(overlapSentence);
        
        if (overlapTokenCount + overlapSentenceTokens <= overlapTokens) {
          overlapSentences.unshift(overlapSentence);
          overlapTokenCount += overlapSentenceTokens;
        } else {
          break;
        }
      }

      // Start new chunk with overlap
      currentChunk = overlapSentences;
      currentTokenCount = overlapTokenCount;
    }

    // Add sentence to current chunk
    currentChunk.push(sentence);
    currentTokenCount += sentenceTokens;
  }

  // Add the last chunk if it has content
  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk.join("").trim(),
      tokenCount: currentTokenCount,
      metadata: {
        chunkIndex: chunkIndex++,
        sectionTitle,
        pageNumber,
      },
    });
  }

  return chunks;
}

/**
 * Chunk a document with multiple sections
 */
export function chunkDocument(
  sections: { title: string; content: string; pageNumber?: number }[],
  options: ChunkingOptions = {}
): ChunkResult[] {
  const allChunks: ChunkResult[] = [];
  
  for (const section of sections) {
    const sectionChunks = chunkText(section.content, {
      ...options,
      sectionTitle: section.title,
      pageNumber: section.pageNumber,
    });
    allChunks.push(...sectionChunks);
  }

  // Update chunk indices to be sequential across all sections
  allChunks.forEach((chunk, index) => {
    if (chunk.metadata) {
      chunk.metadata.chunkIndex = index;
    }
  });

  return allChunks;
}

/**
 * Estimate total chunks needed for a text
 */
export function estimateChunkCount(text: string, maxTokens: number = 1000): number {
  const totalTokens = estimateTokenCount(text);
  return Math.ceil(totalTokens / maxTokens);
}
