export async function cleanupMemberPhotos(client, maxBatches = 100) {
  let removed = 0;
  for (let batch = 0; batch < maxBatches; batch++) {
    const { data, error } = await client.rpc('expired_member_photo_paths');
    if (error) throw new Error('Could not read expired photo queue');
    const paths = (data ?? []).map(row => row.path);
    if (!paths.length) return { removed, complete: true };
    const { error: storageError } = await client.storage.from('member-photos').remove(paths);
    if (storageError) throw new Error('Photo removal failed; metadata retained for retry');
    const { error: finalizeError } = await client.rpc('finalize_member_photo_cleanup', { p_paths: paths });
    if (finalizeError) throw new Error('Metadata cleanup failed; safe to retry');
    removed += paths.length;
  }
  throw new Error('Cleanup batch limit reached; rerun required');
}
