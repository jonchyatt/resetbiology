import { createVaultStructure, logToVault } from '../src/lib/googleDriveService';

// User ID from the list-users script
const USER_ID = '68c274682eab19fcb08e5a2c';

async function main() {
    console.log('--- Starting Vault Verification ---');
    console.log('Target User:', USER_ID);

    try {
        // 1. Test Folder Creation
        console.log('\n1. Testing createVaultStructure...');
        const structure = await createVaultStructure(USER_ID);
        console.log('Vault Structure Created:', structure);

        // 2. Test Logging
        console.log('\n2. Testing logToVault (Nutrition)...');
        await logToVault(USER_ID, 'nutrition', {
            item: 'Test Apple',
            calories: 95,
            notes: 'Logged via verification script'
        });
        console.log('Nutrition log success.');

        console.log('\n3. Testing logToVault (Peptide)...');
        await logToVault(USER_ID, 'peptide', {
            peptide: 'BPC-157',
            dose: '250mcg',
            site: 'Abdomen'
        });
        console.log('Peptide log success.');

        console.log('\n--- Verification Complete: SUCCESS ---');

    } catch (error) {
        console.error('\n--- Verification Failed ---');
        console.error(error);
    }
}

main();
