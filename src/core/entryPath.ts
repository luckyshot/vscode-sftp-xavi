// Treat server-provided names as single path components on every client platform.
export function entryPath(resolver: any, directory: string, name: string): string {
  if (!name || name === '.' || name === '..' || /[\\/\0]/.test(name) || /^[a-z]:/i.test(name)) {
    throw new Error(`Unsafe directory entry name: ${JSON.stringify(name)}`);
  }
  const result = resolver.join(directory, name);
  const relative = resolver.relative(directory, result);
  if (relative === '..' || relative.startsWith('../') || relative.startsWith('..\\') || resolver.isAbsolute(relative)) {
    throw new Error(`Directory entry escapes its parent: ${name}`);
  }
  return result;
}

export function validateEntries(entries: { name: string; fspath: string }[], resolver: any, directory: string) {
  for (const entry of entries) {
    const expected = entryPath(resolver, directory, entry.name);
    if (resolver.normalize(expected) !== resolver.normalize(entry.fspath)) {
      throw new Error(`Directory entry path does not match its parent: ${entry.name}`);
    }
  }
}
