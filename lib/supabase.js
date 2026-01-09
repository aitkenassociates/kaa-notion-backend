/**
 * Supabase Client Configuration
 *
 * Provides storage and database access via Supabase
 * Used for project image uploads and file management
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  console.log('✅ Supabase client initialized');
} else {
  console.log('⚠️  Supabase not configured - storage features will be limited');
}

/**
 * Upload file to Supabase Storage
 * @param {Buffer} fileBuffer - File data
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path in bucket
 * @param {string} contentType - MIME type
 * @returns {Promise<{data: object, error: object}>}
 */
async function uploadFile(fileBuffer, bucket, path, contentType) {
  if (!supabase) {
    throw new Error('Supabase storage not configured');
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, fileBuffer, {
      contentType,
      upsert: false
    });

  if (error) {
    throw error;
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return {
    path: data.path,
    publicUrl
  };
}

/**
 * Delete file from Supabase Storage
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path in bucket
 */
async function deleteFile(bucket, path) {
  if (!supabase) {
    throw new Error('Supabase storage not configured');
  }

  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    throw error;
  }

  return true;
}

/**
 * Get signed URL for private file access
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path in bucket
 * @param {number} expiresIn - Expiry time in seconds (default 1 hour)
 */
async function getSignedUrl(bucket, path, expiresIn = 3600) {
  if (!supabase) {
    throw new Error('Supabase storage not configured');
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

/**
 * List files in a bucket path
 * @param {string} bucket - Storage bucket name
 * @param {string} path - Folder path
 */
async function listFiles(bucket, path = '') {
  if (!supabase) {
    throw new Error('Supabase storage not configured');
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(path, {
      sortBy: { column: 'created_at', order: 'desc' }
    });

  if (error) {
    throw error;
  }

  return data;
}

module.exports = {
  supabase,
  uploadFile,
  deleteFile,
  getSignedUrl,
  listFiles
};
