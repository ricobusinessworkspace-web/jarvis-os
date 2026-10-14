import type { Zelle } from '@/core/services/WochenService';

/**
 * Die Farben des Jarvis-Blocksystems — eine Stelle für „Heute", Vertrieb und
 * Ziele: Weiß = Soll, Grau = Basis, Rot = darunter, Rahmen = nicht gemessen
 * bzw. heute offen, gedämpft = frei oder kommt noch.
 */
export const ZELLE: Record<Zelle, string> = {
  soll: 'bg-foreground',
  basis: 'bg-muted',
  unter: 'bg-error/75',
  leer: 'ring-1 ring-inset ring-tertiary',
  offen: 'ring-[1.5px] ring-inset ring-muted',
  frei: 'bg-elevated',
  kommt: 'bg-elevated/45',
};

export const WOCHENTAGE_KURZ = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];
