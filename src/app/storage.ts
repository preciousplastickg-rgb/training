// SPEC 2: navigator.storage.persist() при первом запуске, чтобы iOS не вычистил IndexedDB.
// Повторяем при каждом старте, пока не разрешено: Safari может отказать в первый раз
// и разрешить позже (например, после установки на экран «Домой»).
export async function requestPersistentStorage(): Promise<boolean> {
  const storage = navigator.storage;
  if (!storage?.persist) return false;
  try {
    if (await storage.persisted()) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}
