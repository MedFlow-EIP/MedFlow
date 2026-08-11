import { getAuthHeaders } from '../../utils/authHeaders';

function makeMockUser(overrides: Partial<{
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  token: string;
}> = {}) {
  const { uid = 'user-123', displayName = 'Camille Dupont', photoURL = 'https://x.com/p.jpg', token = 'fake-id-token' } = overrides;
  return {
    uid,
    displayName,
    photoURL,
    getIdToken: jest.fn().mockResolvedValue(token),
  } as any;
}

describe('getAuthHeaders', () => {
  it('inclut le token Firebase dans Authorization: Bearer', async () => {
    const user = makeMockUser({ token: 'abc123' });

    const headers = await getAuthHeaders(user);

    expect(headers.Authorization).toBe('Bearer abc123');
  });

  it('appelle getIdToken() exactement une fois', async () => {
    const user = makeMockUser();

    await getAuthHeaders(user);

    expect(user.getIdToken).toHaveBeenCalledTimes(1);
  });

  it('inclut X-User-UID (compatibilité backend legacy pendant la transition)', async () => {
    const user = makeMockUser({ uid: 'my-uid-456' });

    const headers = await getAuthHeaders(user);

    expect(headers['X-User-UID']).toBe('my-uid-456');
  });

  it('inclut le nom et la photo affichés', async () => {
    const user = makeMockUser({ displayName: 'Alice', photoURL: 'https://x.com/alice.jpg' });

    const headers = await getAuthHeaders(user);

    expect(headers['X-User-Name']).toBe('Alice');
    expect(headers['X-User-Avatar']).toBe('https://x.com/alice.jpg');
  });

  it('remplace un displayName null par une chaîne vide (pas la chaîne "null")', async () => {
    const user = makeMockUser({ displayName: null });

    const headers = await getAuthHeaders(user);

    expect(headers['X-User-Name']).toBe('');
  });

  it('remplace un photoURL null par une chaîne vide', async () => {
    const user = makeMockUser({ photoURL: null });

    const headers = await getAuthHeaders(user);

    expect(headers['X-User-Avatar']).toBe('');
  });

  it('renvoie exactement les 4 headers attendus, rien de plus', async () => {
    const user = makeMockUser();

    const headers = await getAuthHeaders(user);

    expect(Object.keys(headers).sort()).toEqual(
      ['Authorization', 'X-User-Avatar', 'X-User-Name', 'X-User-UID'].sort()
    );
  });
});