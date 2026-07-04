/**
 * Upload de arquivos no Supabase Storage (fotos de produto e notas fiscais).
 * Usa a Service Role Key (somente no servidor).
 */
const crypto = require('crypto');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || 'barbara';

let supabase = null;
if (SUPABASE_URL && SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
} else {
  console.warn('[ATENCAO] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nao definidos. Uploads nao vao funcionar ate configurar.');
}

// Multer em memoria (sem disco - ideal para serverless)
const memory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

function extFromName(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? '.' + m[1].toLowerCase() : '';
}

/**
 * Envia um arquivo (req.file do multer) para o Storage e retorna
 * { url, key } com a URL pública e o caminho interno.
 */
async function uploadFile(file, folder) {
  if (!supabase) throw new Error('Storage não configurado (Supabase).');
  const key = `${folder}/${crypto.randomBytes(10).toString('hex')}${extFromName(file.originalname)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(key, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });
  if (error) throw new Error('Falha ao enviar arquivo: ' + error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return { url: data.publicUrl, key };
}

/** Remove um arquivo do Storage pelo caminho interno. */
async function removeFile(key) {
  if (!supabase || !key) return;
  try { await supabase.storage.from(BUCKET).remove([key]); } catch (_) {}
}

module.exports = { memory, uploadFile, removeFile, storageReady: !!supabase };
