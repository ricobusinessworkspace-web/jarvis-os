import { TaskService } from '@/core/services/TaskService';
import { TaskClient } from './client/TaskClient';

export default async function TaskWidget() {
  const res = await TaskService.getDashboardTasks();
  const tasks = res.tasks || [];

  return (
    <TaskClient initialTasks={tasks} />
  );
}
