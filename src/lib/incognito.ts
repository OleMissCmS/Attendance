export async function detectIncognito(): Promise<boolean> {
  try {
    if ("storage" in navigator && "getDirectory" in navigator.storage) {
      await navigator.storage.getDirectory()
    }
  } catch {
    return true
  }

  try {
    const quota = (await navigator.storage?.estimate())?.quota ?? 0
    if (quota > 0 && quota < 120 * 1024 * 1024) return true
  } catch {
    // ignore
  }

  try {
    const request = indexedDB.open("attendance-incognito-probe")
    const incognito = await new Promise<boolean>((resolve) => {
      request.onerror = () => resolve(true)
      request.onsuccess = () => {
        request.result.close()
        indexedDB.deleteDatabase("attendance-incognito-probe")
        resolve(false)
      }
    })
    if (incognito) return true
  } catch {
    return true
  }

  return false
}
