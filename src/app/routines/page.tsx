import { redirect } from 'next/navigation';

/**
 * Früher das Tippziel des Routine-Widgets. Das Widget ist abgebaut (14.10.);
 * ein noch platziertes altes Widget landet so auf „Heute" statt auf einer 404.
 */
export default function RoutinesPage() {
  redirect('/');
}
