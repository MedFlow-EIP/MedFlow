import { scrubEvent } from '../sentry';

jest.mock('@sentry/react-native', () => ({ init: jest.fn(), wrap: (c: any) => c }));

it('retire identité, contenu des requêtes et données du fil d’Ariane', () => {
  const event = scrubEvent({
    user: { id: 'uid', email: 'a@b.fr' },
    request: { url: '/chat', data: { message: 'douleur' }, headers: { Authorization: 'Bearer x' } },
    breadcrumbs: [{ category: 'fetch', data: { url: 'https://api/chat', body: 'secret' } }, { category: 'navigation' }],
  });
  expect(event.user).toBeUndefined();
  expect(event.request).toEqual({ url: '/chat' });
  expect(event.breadcrumbs).toEqual([
    { category: 'fetch', data: { url: 'https://api/chat' } },
    { category: 'navigation', data: undefined },
  ]);
});
