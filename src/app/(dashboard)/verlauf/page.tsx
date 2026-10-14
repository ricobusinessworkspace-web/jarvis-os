import { redirect } from 'next/navigation';

/**
 * Abgebaut am 14.10.2026 (neues Design, vier Reiter). Nur heute ist
 * bearbeitbar, die Woche steht auf „Heute", Serien und Rekorde unter „Ziele".
 * Alte Lesezeichen landen so auf „Heute" statt auf einer 404.
 */
export default function Page() {
  redirect('/');
}
