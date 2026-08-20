/** Best-effort OS-ARCH key from a Tauri updater artifact filename. */
export function inferTauriTarget(filename: string): string | null {
  const name = filename.toLowerCase()
  const arch = name.includes('aarch64') || name.includes('arm64')
    ? 'aarch64'
    : name.includes('i686') || name.includes('ia32')
      ? 'i686'
      : name.includes('armv7')
        ? 'armv7'
        : name.includes('x64') || name.includes('x86_64') || name.includes('amd64')
          ? 'x86_64'
          : null

  const os = name.includes('darwin') || name.includes('mac') || name.endsWith('.app.tar.gz')
    ? 'darwin'
    : name.includes('linux') || name.includes('appimage')
      ? 'linux'
      : name.includes('win') || name.includes('nsis') || name.includes('msi')
        ? 'windows'
        : null

  if (!os || !arch) return null
  return `${os}-${arch}`
}
