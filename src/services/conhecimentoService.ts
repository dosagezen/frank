
import { supabase } from '../lib/supabaseClient';
import type { ConhecimentoItem } from '../mocks/conhecimento';

interface KnowledgeBaseRow {
  id: number;
  titulo: string;
  descricao: string;
  link: string;
  thumbnail: string;
  autor: string;
  data_publicacao: string;
  visualizado: boolean;
  visualizacoes: number;
  tags: string[];
}

/**
 * Convert a row coming from Supabase into the front‑end model.
 * Guarantees default values for optional fields so the rest of the app
 * never has to check for undefined.
 */
function rowToItem(row: KnowledgeBaseRow): ConhecimentoItem {
  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    link: row.link,
    thumbnail: row.thumbnail ?? '',
    autor: row.autor,
    dataPublicacao: row.data_publicacao,
    visualizado: row.visualizado,
    visualizacoes: row.visualizacoes,
    tags: row.tags ?? [],
  };
}

/**
 * Fetch all knowledge‑base entries.
 * Throws a descriptive error if the request fails.
 */
export async function fetchConhecimentos(): Promise<ConhecimentoItem[]> {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch conhecimentos: ${error.message}`);
  }

  // `data` can be null when the table is empty – guard against it.
  const rows = (data ?? []) as KnowledgeBaseRow[];
  return rows.map(rowToItem);
}

/**
 * Create a new knowledge‑base entry.
 * Returns the freshly created item with its generated ID.
 */
export async function createConhecimento(
  item: Omit<ConhecimentoItem, 'id' | 'visualizado' | 'visualizacoes'>
): Promise<ConhecimentoItem> {
  const { data, error } = await supabase
    .from('knowledge_base')
    .insert({
      titulo: item.titulo,
      descricao: item.descricao,
      link: item.link,
      thumbnail: item.thumbnail ?? '',
      autor: item.autor,
      data_publicacao: item.dataPublicacao,
      visualizado: false,
      visualizacoes: 0,
      tags: item.tags,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create conhecimento: ${error.message}`);
  }

  return rowToItem(data as KnowledgeBaseRow);
}

/**
 * Update an existing knowledge‑base entry.
 */
export async function updateConhecimento(item: ConhecimentoItem): Promise<void> {
  const { error } = await supabase
    .from('knowledge_base')
    .update({
      titulo: item.titulo,
      descricao: item.descricao,
      link: item.link,
      thumbnail: item.thumbnail ?? '',
      autor: item.autor,
      data_publicacao: item.dataPublicacao,
      tags: item.tags,
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.id);

  if (error) {
    throw new Error(`Failed to update conhecimento (id=${item.id}): ${error.message}`);
  }
}

/**
 * Increment the view counter for a given entry.
 * Also marks the entry as “visualizado”.
 */
export async function incrementVisualizacao(
  id: number,
  currentCount: number
): Promise<void> {
  const { error } = await supabase
    .from('knowledge_base')
    .update({
      visualizado: true,
      visualizacoes: currentCount + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to increment visualizacao (id=${id}): ${error.message}`);
  }
}

/**
 * Delete a knowledge‑base entry by ID.
 */
export async function deleteConhecimento(id: number): Promise<void> {
  const { error } = await supabase
    .from('knowledge_base')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete conhecimento (id=${id}): ${error.message}`);
  }
}
