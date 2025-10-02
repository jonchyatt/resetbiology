import { MongoClient } from 'mongodb';

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error('Missing DATABASE_URL');
  const client = new MongoClient(uri);
  await client.connect();
  const dbName = new URL(uri).pathname.replace(/^\//, '') || undefined;
  const db = client.db(dbName);
  // Collection used by the cache layer (from earlier nutrition code)
  const col = db.collection('food_refs');
  // Create index if not exists: expire after 90 days
  await col.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });
  console.log('TTL index ensured on food_refs.createdAt (90 days).');
  await client.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
