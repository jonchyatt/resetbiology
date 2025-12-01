import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Scopes required for the Vault
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

/**
 * Retrieves the authenticated Google Drive client for a specific user.
 * Assumes the user has already authenticated via OAuth and we have a refresh token.
 */
async function getDriveClient(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleDriveRefreshToken: true },
  });

  if (!user || !user.googleDriveRefreshToken) {
    throw new Error('User is not connected to Google Drive');
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  auth.setCredentials({
    refresh_token: user.googleDriveRefreshToken,
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * Creates the standard "Reset Biology Vault" folder structure in the user's Drive.
 * /Reset_Biology_Vault
 *   /Logs
 *   /Journal
 *   /Profile
 */
export async function createVaultStructure(userId: string) {
  const drive = await getDriveClient(userId);

  // 1. Check if Root Folder exists
  const rootQuery = "mimeType='application/vnd.google-apps.folder' and name='Reset_Biology_Vault' and trashed=false";
  const rootRes = await drive.files.list({
    q: rootQuery,
    spaces: 'drive',
    fields: 'files(id, name)',
  });

  let rootFolderId;

  if (rootRes.data.files && rootRes.data.files.length > 0) {
    rootFolderId = rootRes.data.files[0].id;
    console.log('Found existing Vault:', rootFolderId);
  } else {
    // Create Root Folder
    const fileMetadata = {
      name: 'Reset_Biology_Vault',
      mimeType: 'application/vnd.google-apps.folder',
    };
    const file = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });
    rootFolderId = file.data.id;
    console.log('Created new Vault:', rootFolderId);
  }

  // 2. Create Subfolders
  const subfolders = ['Logs', 'Journal', 'Profile'];
  const folderIds: Record<string, string> = {};

  for (const folderName of subfolders) {
    const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${rootFolderId}' in parents and trashed=false`;
    const res = await drive.files.list({
      q: query,
      spaces: 'drive',
      fields: 'files(id, name)',
    });

    if (res.data.files && res.data.files.length > 0) {
      folderIds[folderName] = res.data.files[0].id!;
    } else {
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootFolderId!],
      };
      const file = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id',
      });
      folderIds[folderName] = file.data.id!;
      console.log(`Created subfolder ${folderName}:`, file.data.id);
    }
  }

  // 3. Save folder ID to user profile for quick access
  await prisma.user.update({
    where: { id: userId },
    data: {
      driveFolder: rootFolderId,
      drivePermissions: folderIds, // Storing subfolder IDs as JSON
      googleDriveSyncEnabled: true,
      googleDriveConnectedAt: new Date(),
    },
  });

  return { rootFolderId, folderIds };
}

/**
 * Appends a row to a CSV log file in the Vault.
 * Used by agents to log events (e.g., "Took BPC-157").
 */
export async function logToVault(userId: string, logType: 'nutrition' | 'peptide' | 'vision' | 'workout', data: any) {
  const drive = await getDriveClient(userId);
  
  // Get subfolder ID from DB
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { drivePermissions: true },
  });
  
  const folders = user?.drivePermissions as Record<string, string>;
  const logsFolderId = folders?.['Logs'];

  if (!logsFolderId) {
    throw new Error('Vault Logs folder not found. Run createVaultStructure first.');
  }

  const fileName = `${logType}_tracker.csv`;

  // Check if file exists
  const query = `name='${fileName}' and '${logsFolderId}' in parents and trashed=false`;
  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
  });

  let fileId;
  let currentContent = '';

  if (res.data.files && res.data.files.length > 0) {
    fileId = res.data.files[0].id;
    // Download current content
    const file = await drive.files.get({
      fileId: fileId!,
      alt: 'media',
    });
    currentContent = file.data as string;
  }

  // Format data as CSV row
  const timestamp = new Date().toISOString();
  const row = `${timestamp},${Object.values(data).join(',')}\n`;
  
  const newContent = currentContent + row;

  if (fileId) {
    // Update existing file
    await drive.files.update({
      fileId: fileId,
      media: {
        mimeType: 'text/csv',
        body: newContent,
      },
    });
  } else {
    // Create new file with header
    const header = `timestamp,${Object.keys(data).join(',')}\n`;
    await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [logsFolderId],
      },
      media: {
        mimeType: 'text/csv',
        body: header + row,
      },
    });
  }
}
