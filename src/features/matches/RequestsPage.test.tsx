import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import RequestsPage from './RequestsPage';
import { ko } from '@/i18n/ko';
const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('./matches.api', () => ({ fetchMyRequests: api.fetch, acceptRequest: vi.fn(), rejectRequest: vi.fn() }));
vi.mock('@/components/layout/PageLayout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/match/MatchRequestCard', () => ({ default: ({ request }: { request: { id: string } }) => <article>{request.id}</article> }));
const result = (id: string) => ({ incoming: [{ id, status: 'pending' }], outgoing: [] });
function deferred() {
  let resolve!: (value: ReturnType<typeof result>) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<ReturnType<typeof result>>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => { vi.useFakeTimers(); api.fetch.mockReset(); });
afterEach(() => { vi.useRealTimers(); });
const mount = () => render(<MemoryRouter><RequestsPage /></MemoryRouter>);

describe('request list retry ordering', () => {
  it.each(['success', 'error'])('ignores the old request after a newer retry succeeds, including old %s', async (outcome) => {
    const old = deferred();
    const latest = deferred();
    api.fetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(12000); });
    expect(screen.getByText(ko.requests.loadFailed)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: ko.common.retry }));
    expect(screen.queryByText(ko.requests.loadFailed)).not.toBeInTheDocument();
    expect(screen.getByText(ko.common.loading)).toBeInTheDocument();
    await act(async () => latest.resolve(result('latest-result')));
    expect(screen.getByText('latest-result')).toBeInTheDocument();
    await act(async () => {
      if (outcome === 'success') old.resolve(result('old-result'));
      else old.reject(new Error('old failure'));
    });
    expect(screen.getByText('latest-result')).toBeInTheDocument();
    expect(screen.queryByText('old-result')).not.toBeInTheDocument();
    expect(screen.queryByText(ko.requests.loadFailed)).not.toBeInTheDocument();
  });

  it('clears the timeout warning when the current request eventually succeeds', async () => {
    const slow = deferred();
    api.fetch.mockReturnValue(slow.promise);
    mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(12000); });
    expect(screen.getByText(ko.requests.loadFailed)).toBeInTheDocument();
    await act(async () => slow.resolve(result('recovered-result')));
    expect(screen.getByText('recovered-result')).toBeInTheDocument();
    expect(screen.queryByText(ko.requests.loadFailed)).not.toBeInTheDocument();
  });

  it('cleans the page timeout when navigation unmounts the list', () => {
    api.fetch.mockReturnValue(new Promise(() => undefined));
    const { unmount } = mount();
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
