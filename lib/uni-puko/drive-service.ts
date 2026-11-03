import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { SupabaseClient } from '@supabase/supabase-js';

export type PukoStageKey = 'planlama' | 'uygulama' | 'kontrol' | 'onlem' | 'odr';

const STAGE_FOLDER_NAMES: Record<PukoStageKey, string> = {
  planlama: '1_Planlama',
  uygulama: '2_Uygulama',
  kontrol: '3_Kontrol',
  onlem: '4_Onlem_Alma',
  odr: '5_ODR_Kanitlari',
};

export function parseStorageUrl(rawUrl: string): { bucket: string; filePath: string } | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const clean = rawUrl.split('#')[0].split('?')[0].trim();
  const m1 = clean.match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+)$/);
  if (m1) {
    return { bucket: m1[1], filePath: decodeURIComponent(m1[2]) };
  }
  const m2 = clean.match(/\/api\/storage\/([^/]+)\/(.+)$/);
  if (m2) {
    return { bucket: m2[1], filePath: decodeURIComponent(m2[2]) };
  }
  return null;
}

export function normalizeStorageKey(rawUrl: string): string | null {
  const parsed = parseStorageUrl(rawUrl);
  if (!parsed) return null;
  return `${parsed.bucket}/${parsed.filePath}`;
}

export function detectStageFromUrl(rawUrl: string, fallback: PukoStageKey = 'odr'): PukoStageKey {
  if (!rawUrl) return fallback;
  const lower = rawUrl.toLowerCase();
  if (lower.includes('_planlama_')) return 'planlama';
  if (lower.includes('_uygulama_')) return 'uygulama';
  if (lower.includes('_kontrol_')) return 'kontrol';
  if (lower.includes('_onlem_')) return 'onlem';
  return fallback;
}

function getDriveClient(): { drive: drive_v3.Drive; rootFolderId: string } {
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1UTm_ONdVoityeQ20pKM4-s7I1OrCZVro';

  if (!rawKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY sunucu ortam değişkeni tanımlı değil.');
  }

  let credentials: { client_email: string; private_key: string };
  try {
    const trimmed = rawKey.trim().replace(/^['"]|['"]$/g, '');
    if (trimmed.startsWith('{')) {
      credentials = JSON.parse(trimmed);
    } else {
      credentials = JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
    }
  } catch (err: any) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY JSON ayrıştırma hatası: ' + err.message);
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });
  return { drive, rootFolderId };
}

interface DriveFolderFileEntry {
  id: string;
  name: string;
  size: number;
  storageKey?: string;
}

export class UniPukoDriveManager {
  private drive: drive_v3.Drive;
  private rootFolderId: string;
  private supabaseAdmin: SupabaseClient;
  private folderCache = new Map<string, string>(); // parentId::folderName -> folderId
  private fileInFolderCache = new Map<string, DriveFolderFileEntry[]>(); // folderId -> files
  private resolvedUrlCache = new Map<string, string>(); // stage::storageKey -> driveFileUrl
  private rootOwnerEmail: string | null = null;
  private rootOwnerPermissionId: string | null = null;

  constructor(supabaseAdmin: SupabaseClient) {
    const { drive, rootFolderId } = getDriveClient();
    this.drive = drive;
    this.rootFolderId = rootFolderId;
    this.supabaseAdmin = supabaseAdmin;
  }

  private async ensureRootOwnerInfo(): Promise<{ email: string | null; permissionId: string | null }> {
    if (this.rootOwnerPermissionId || this.rootOwnerEmail) {
      return { email: this.rootOwnerEmail, permissionId: this.rootOwnerPermissionId };
    }
    const rootMeta = await this.drive.files.get({
      fileId: this.rootFolderId,
      fields: 'owners(emailAddress, permissionId)',
      supportsAllDrives: true,
    });
    const owner = rootMeta.data.owners?.[0];
    this.rootOwnerEmail = owner?.emailAddress || null;
    this.rootOwnerPermissionId = owner?.permissionId || null;
    return { email: this.rootOwnerEmail, permissionId: this.rootOwnerPermissionId };
  }

  private async ensureFolder(parentId: string, folderName: string): Promise<string> {
    const cacheKey = `${parentId}::${folderName}`;
    const cached = this.folderCache.get(cacheKey);
    if (cached) return cached;

    const escapedName = folderName.replace(/'/g, "\\'");
    const listRes = await this.drive.files.list({
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${escapedName}' and trashed = false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (listRes.data.files && listRes.data.files.length > 0 && listRes.data.files[0].id) {
      const existingId = listRes.data.files[0].id;
      this.folderCache.set(cacheKey, existingId);
      return existingId;
    }

    const createRes = await this.drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });

    if (!createRes.data.id) {
      throw new Error(`Google Drive üzerinde klasör oluşturulamadı: ${folderName}`);
    }

    const newId = createRes.data.id;
    this.folderCache.set(cacheKey, newId);
    return newId;
  }

  private async getFilesInFolder(folderId: string): Promise<DriveFolderFileEntry[]> {
    if (this.fileInFolderCache.has(folderId)) {
      return this.fileInFolderCache.get(folderId)!;
    }

    const entries: DriveFolderFileEntry[] = [];
    const listRes = await this.drive.files.list({
      q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name, size, appProperties)',
      pageSize: 500,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    for (const f of listRes.data.files || []) {
      if (f.id && f.name) {
        entries.push({
          id: f.id,
          name: f.name.trim(),
          size: Number(f.size || 0),
          storageKey: f.appProperties?.storageKey,
        });
      }
    }

    this.fileInFolderCache.set(folderId, entries);
    return entries;
  }

  public async resolveEvidenceDriveUrl(params: {
    rawUrl: string;
    displayName: string;
    iaaKodu: string;
    stage: PukoStageKey;
  }): Promise<string> {
    const { rawUrl, displayName, iaaKodu, stage } = params;
    if (!rawUrl || !rawUrl.trim()) {
      throw new Error(`Kanıt URL adresi boş (${iaaKodu} - ${displayName || 'İsimsiz Kanıt'}).`);
    }

    const normalizedUrl = rawUrl.split('#')[0].split('?')[0].trim();
    const parsed = parseStorageUrl(normalizedUrl);
    if (!parsed) {
      throw new Error(`Geçersiz depolama kanıt adresi (${iaaKodu} - ${displayName}): ${rawUrl}`);
    }

    const storageKey = `${parsed.bucket}/${parsed.filePath}`;
    const cacheKey = `${iaaKodu.trim()}::${stage}::${storageKey}`;
    if (this.resolvedUrlCache.has(cacheKey)) {
      return this.resolvedUrlCache.get(cacheKey)!;
    }

    const criterionFolderId = await this.ensureFolder(this.rootFolderId, iaaKodu.trim());
    const stageFolderName = STAGE_FOLDER_NAMES[stage] || STAGE_FOLDER_NAMES.odr;
    const stageFolderId = await this.ensureFolder(criterionFolderId, stageFolderName);

    const storageFileName = parsed.filePath.split('/').pop() || 'kanit.pdf';
    const ext = storageFileName.includes('.') ? storageFileName.slice(storageFileName.lastIndexOf('.')) : '.pdf';

    let cleanFileName = (displayName || storageFileName).trim().replace(/[\\/:*?"<>|]/g, '_');
    if (!cleanFileName.toLowerCase().endsWith(ext.toLowerCase())) {
      cleanFileName += ext;
    }

    // 1. Check if this exact file already exists (with non-zero size) in the stage folder on Google Drive
    const existingFiles = await this.getFilesInFolder(stageFolderId);
    const matchedExisting = existingFiles.find(
      f =>
        f.size > 0 &&
        (f.storageKey === storageKey ||
          (!f.storageKey && f.name.toLowerCase() === storageFileName.toLowerCase()))
    );

    if (matchedExisting) {
      const fileLink = `https://drive.google.com/file/d/${matchedExisting.id}/view?usp=sharing`;
      this.resolvedUrlCache.set(cacheKey, fileLink);
      return fileLink;
    }

    // 2. Download binary file from Supabase Storage (read-only)
    const { data: blob, error: dlErr } = await this.supabaseAdmin.storage
      .from(parsed.bucket)
      .download(parsed.filePath);

    if (dlErr || !blob) {
      throw new Error(
        `Supabase depolama alanından kanıt dosyası indirilemedi (${storageKey}): ${dlErr?.message || 'Dosya bulunamadı'}`
      );
    }

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0) {
      throw new Error(`Supabase depolama alanından indirilen kanıt dosyası boş (${storageKey}).`);
    }

    const mimeType = blob.type || 'application/pdf';

    // 3. Upload file to Google Drive:
    // Step 3a: Create 0-byte metadata entry in the target stage folder with appProperties.storageKey
    const createRes = await this.drive.files.create({
      requestBody: {
        name: cleanFileName,
        mimeType,
        parents: [stageFolderId],
        appProperties: {
          storageKey,
        },
      },
      fields: 'id, permissions(id, emailAddress, role)',
      supportsAllDrives: true,
    });

    const createdFileId = createRes.data.id;
    if (!createdFileId) {
      throw new Error(`Google Drive üzerinde kanıt dosyası kaydı oluşturulamadı (${cleanFileName}).`);
    }

    // Step 3b: Transfer ownership of the entry to the Drive folder owner so binary content uses owner's Drive quota
    const { email: ownerEmail, permissionId: ownerPermId } = await this.ensureRootOwnerInfo();
    const filePerms = createRes.data.permissions || [];
    const targetOwnerPerm = filePerms.find(
      p =>
        (ownerPermId && p.id === ownerPermId) ||
        (ownerEmail && p.emailAddress?.toLowerCase() === ownerEmail.toLowerCase()) ||
        (p.role === 'writer' && p.id !== 'anyoneWithLink')
    );

    if (!targetOwnerPerm?.id) {
      throw new Error(`Google Drive klasör sahibi yetkisi bulunamadı (${cleanFileName}).`);
    }

    await this.drive.permissions.update({
      fileId: createdFileId,
      permissionId: targetOwnerPerm.id,
      transferOwnership: true,
      requestBody: {
        role: 'owner',
      },
      supportsAllDrives: true,
    });

    // Step 3c: Upload binary content into the Drive file
    const updateRes = await this.drive.files.update({
      fileId: createdFileId,
      media: {
        mimeType,
        body: Readable.from([buffer]),
      },
      fields: 'id, size',
      supportsAllDrives: true,
    });

    const finalId = updateRes.data.id;
    const finalSize = Number(updateRes.data.size || 0);
    if (!finalId || finalSize === 0) {
      throw new Error(`Google Drive kanıt dosyası içeriği yüklenemedi (${cleanFileName}).`);
    }

    existingFiles.push({
      id: finalId,
      name: cleanFileName,
      size: finalSize,
      storageKey,
    });

    const fileLink = `https://drive.google.com/file/d/${finalId}/view?usp=sharing`;
    this.resolvedUrlCache.set(cacheKey, fileLink);
    return fileLink;
  }
}
