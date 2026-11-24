import { redondear1, seCruzan } from './utils';

describe('seCruzan (CP-04)', () => {
  it('detecta el mismo horario', () => expect(seCruzan('08:00', '10:00', '08:00', '10:00')).toBe(true));
  it('detecta cruce parcial', () => expect(seCruzan('09:00', '11:00', '08:00', '10:00')).toBe(true));
  it('permite franjas contiguas', () => expect(seCruzan('10:00', '12:00', '08:00', '10:00')).toBe(false));
  it('permite franjas separadas', () => expect(seCruzan('14:00', '16:00', '08:00', '10:00')).toBe(false));
});

describe('redondear1 (CP-05)', () => {
  it('4.0*30% + 3.0*30% + 2.5*40% = 3.1', () => expect(redondear1(4 * 0.3 + 3 * 0.3 + 2.5 * 0.4)).toBe(3.1));
  it('5.0 en todo = 5.0', () => expect(redondear1(5 * 0.3 + 5 * 0.3 + 5 * 0.4)).toBe(5));
  it('redondea la mitad hacia arriba', () => expect(redondear1(3.05)).toBe(3.1));
});
