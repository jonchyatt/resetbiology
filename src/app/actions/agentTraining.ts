'use server';

import { createVaultStructure, getDriveClient } from '@/lib/googleDriveService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function saveAgentTraining(userId: string, agentName: string, trainingText: string) {
    try {
        const drive = await getDriveClient(userId);

        // 1. Get/Create "Training" folder in Vault
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { drivePermissions: true, driveFolder: true },
        });

        if (!user?.driveFolder) {
            throw new Error('Vault not initialized');
        }

        // Check for Training folder
        const query = `mimeType='application/vnd.google-apps.folder' and name='Training' and '${user.driveFolder}' in parents and trashed=false`;
        const res = await drive.files.list({ q: query });

        let trainingFolderId;
        if (res.data.files && res.data.files.length > 0) {
            trainingFolderId = res.data.files[0].id;
        } else {
            const file = await drive.files.create({
                requestBody: {
                    name: 'Training',
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [user.driveFolder],
                },
                fields: 'id',
            });
            trainingFolderId = file.data.id;
        }

        // 2. Save/Update the Agent's File
        const fileName = `${agentName}_Instructions.txt`;
        const fileQuery = `name='${fileName}' and '${trainingFolderId}' in parents and trashed=false`;
        const fileRes = await drive.files.list({ q: fileQuery });

        if (fileRes.data.files && fileRes.data.files.length > 0) {
            // Update
            await drive.files.update({
                fileId: fileRes.data.files[0].id!,
                media: {
                    mimeType: 'text/plain',
                    body: trainingText,
                },
            });
        } else {
            // Create
            await drive.files.create({
                requestBody: {
                    name: fileName,
                    parents: [trainingFolderId!],
                },
                media: {
                    mimeType: 'text/plain',
                    body: trainingText,
                },
            });
        }

        return { success: true };
    } catch (error) {
        'use server';

        import { createVaultStructure, getDriveClient } from '@/lib/googleDriveService';
        import { PrismaClient } from '@prisma/client';

        const prisma = new PrismaClient();

        export async function saveAgentTraining(userId: string, agentName: string, trainingText: string) {
            try {
                const drive = await getDriveClient(userId);

                // 1. Get/Create "Training" folder in Vault
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { drivePermissions: true, driveFolder: true },
                });

                if (!user?.driveFolder) {
                    throw new Error('Vault not initialized');
                }

                // Check for Training folder
                const query = `mimeType='application/vnd.google-apps.folder' and name='Training' and '${user.driveFolder}' in parents and trashed=false`;
                const res = await drive.files.list({ q: query });

                let trainingFolderId;
                if (res.data.files && res.data.files.length > 0) {
                    trainingFolderId = res.data.files[0].id;
                } else {
                    const file = await drive.files.create({
                        requestBody: {
                            name: 'Training',
                            mimeType: 'application/vnd.google-apps.folder',
                            parents: [user.driveFolder],
                        },
                        fields: 'id',
                    });
                    trainingFolderId = file.data.id;
                }

                // 2. Save/Update the Agent's File
                const fileName = `${agentName}_Instructions.txt`;
                const fileQuery = `name='${fileName}' and '${trainingFolderId}' in parents and trashed=false`;
                const fileRes = await drive.files.list({ q: fileQuery });

                if (fileRes.data.files && fileRes.data.files.length > 0) {
                    // Update
                    await drive.files.update({
                        fileId: fileRes.data.files[0].id!,
                        media: {
                            mimeType: 'text/plain',
                            body: trainingText,
                        },
                    });
                } else {
                    // Create
                    await drive.files.create({
                        requestBody: {
                            name: fileName,
                            parents: [trainingFolderId!],
                        },
                        media: {
                            mimeType: 'text/plain',
                            body: trainingText,
                        },
                    });
                }

                return { success: true };
            } catch (error) {
                console.error('Failed to save training:', error);
                return { success: false, error: 'Failed to save to Vault' };
            }
        }

        export async function getAgentTraining(userId: string, agentName: string) {
            try {
                const drive = await getDriveClient(userId);
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { driveFolder: true },
                });

                if (!user?.driveFolder) return "";

                // Find Training Folder
                const query = `mimeType='application/vnd.google-apps.folder' and name='Training' and '${user.driveFolder}' in parents and trashed=false`;
                const res = await drive.files.list({ q: query });

                if (!res.data.files || res.data.files.length === 0) return "";
                const trainingFolderId = res.data.files[0].id;

                // Find Agent File
                const fileName = `${agentName}_Instructions.txt`;
                const fileQuery = `name='${fileName}' and '${trainingFolderId}' in parents and trashed=false`;
                const fileRes = await drive.files.list({ q: fileQuery });

                if (!fileRes.data.files || fileRes.data.files.length === 0) return "";

                // Download Content
                const fileId = fileRes.data.files[0].id!;
                const file = await drive.files.get({
                    fileId: fileId,
                    alt: 'media',
                });

                return file.data as string;
            } catch (error) {
                console.error('Error reading training:', error);
                return "";
            }
        }
