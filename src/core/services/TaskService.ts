import { prisma } from '../db';

export class TaskService {
  static async getTasks() {
    try {
      const tasks = await prisma.task.findMany({
        where: { status: 'todo' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { project: true }
      });
      
      return { 
        tasks: tasks.map(t => ({ 
          title: t.title, 
          priority: t.priority, 
          project: t.project?.name || '', 
          dueDate: t.dueDate 
        })) 
      };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  static async getDashboardTasks() {
    try {
      const tasks = await prisma.task.findMany({
        orderBy: { createdAt: 'desc' },
        include: { project: true, goal: true }
      });
      return { tasks };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  static async updateTask(id: string, data: any) {
    try {
      const updated = await prisma.task.update({ where: { id }, data });
      return { success: true, data: updated };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  static async createTask(data: any) {
    try {
      const created = await prisma.task.create({ data });
      return { success: true, data: created };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  static async deleteTask(id: string) {
    try {
      await prisma.task.delete({ where: { id } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
