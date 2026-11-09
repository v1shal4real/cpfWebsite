import { describe, expect, it, vi } from 'vitest';
import { copyText, type CopyEnvironment } from './copyText';

/** A minimal stand-in for the DOM pieces the legacy path touches. */
function fakeDocument(execResult: boolean | 'throw') {
  const appended: unknown[] = [];
  const area = { value: '', style: {} as Record<string, string>, setAttribute: vi.fn(), select: vi.fn() };
  const doc = {
    body: {
      appendChild: (node: unknown) => appended.push(node),
      removeChild: (node: unknown) => appended.splice(appended.indexOf(node), 1),
    },
    activeElement: null,
    createElement: () => area,
    execCommand: vi.fn(() => {
      if (execResult === 'throw') throw new Error('nope');
      return execResult;
    }),
  };
  return { doc: doc as unknown as Document, area, appended, execCommand: doc.execCommand };
}

const URL = 'https://example.test/?v=1&a=30';

describe('copyText', () => {
  it('uses the Clipboard API when it is available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const { doc, execCommand } = fakeDocument(true);
    await expect(copyText(URL, { navigator: { clipboard: { writeText } }, document: doc })).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(URL);
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('falls back to execCommand when the Clipboard API is missing', async () => {
    const { doc, area, appended, execCommand } = fakeDocument(true);
    await expect(copyText(URL, { navigator: {}, document: doc })).resolves.toBe(true);
    expect(area.value).toBe(URL);
    expect(area.select).toHaveBeenCalled();
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(appended).toHaveLength(0);
  });

  it('falls back when the Clipboard API rejects the write', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    const { doc, execCommand } = fakeDocument(true);
    await expect(copyText(URL, { navigator: { clipboard: { writeText } }, document: doc })).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it.each([false, 'throw'] as const)('reports failure when the fallback also fails (%s)', async (result) => {
    const { doc, appended } = fakeDocument(result);
    await expect(copyText(URL, { navigator: {}, document: doc })).resolves.toBe(false);
    expect(appended).toHaveLength(0);
  });

  it('reports failure with no clipboard and no document', async () => {
    const env: CopyEnvironment = {};
    await expect(copyText(URL, env)).resolves.toBe(false);
  });
});
