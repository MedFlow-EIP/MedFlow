import { shuffle } from '../shuffle';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('shuffle', () => {
  it('garde exactement les mêmes éléments', () => {
    const input = ['A', 'B', 'C', 'D', 'E'];
    expect(shuffle(input).sort()).toEqual(input);
  });

  it('ne modifie pas le tableau d\'origine', () => {
    const input = [1, 2, 3];
    shuffle(input);
    expect(input).toEqual([1, 2, 3]);
  });

  it('change l\'ordre selon le tirage aléatoire', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(shuffle(['A', 'B', 'C', 'D'])).toEqual(['B', 'C', 'D', 'A']);
  });
});
