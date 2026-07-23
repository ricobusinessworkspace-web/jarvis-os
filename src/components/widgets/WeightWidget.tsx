import { WeightService } from '@/core/services/WeightService';
import { WeightClient } from './client/WeightClient';

export default async function WeightWidget() {
  const res = await WeightService.getLatestEntries();
  const items = res.items || [];

  return (
    <WeightClient initialItems={items} />
  );
}
