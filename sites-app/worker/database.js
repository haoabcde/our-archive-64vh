export function database(env){ if(!env.DB)throw new Error('Archive database unavailable'); return env.DB; }
export async function seedArchive(env,items){
  const db=database(env);
  const row=await db.prepare('SELECT value FROM preferences WHERE key = ?').bind('archive-seeded-v1').first();
  if(row)return;
  const stmt='INSERT OR IGNORE INTO records (id,type,title,body,place,category,photo_key,occurred_on,open_on,author,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)';
  await db.batch(items.map(r=>db.prepare(stmt).bind(r.id,r.type,r.title,r.body,r.place,r.category,r.photo_key,r.occurred_on,r.open_on,r.author,r.created_at,r.updated_at)));
  await db.prepare('INSERT OR IGNORE INTO preferences (key,value,updated_at) VALUES (?,?,?)').bind('archive-seeded-v1','1',new Date().toISOString()).run();
}
