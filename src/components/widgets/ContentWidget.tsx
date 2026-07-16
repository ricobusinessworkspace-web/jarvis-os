import { ContentService } from '@/core/services/ContentService';
import { ContentClient } from './client/ContentClient';

export default async function ContentWidget() {
  const res = await ContentService.getContentPipeline();
  const items = res.items || [];

  return (
    <ContentClient initialItems={items} />
  );
}
