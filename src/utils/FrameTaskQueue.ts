interface QueuedTask {
  isCancelled: boolean;
  run: () => void;
}

export class FrameTaskQueue {
  private readonly tasks: QueuedTask[] = [];
  private readonly tasksPerFrame: number;
  private frameId: number | null = null;

  constructor(tasksPerFrame: number) {
    this.tasksPerFrame = tasksPerFrame;
  }

  enqueue(run: () => void) {
    const task: QueuedTask = { isCancelled: false, run };

    this.tasks.push(task);
    this.scheduleFrame();

    return () => {
      task.isCancelled = true;
    };
  }

  private scheduleFrame() {
    if (this.frameId !== null) {
      return;
    }

    this.frameId = requestAnimationFrame(this.flush);
  }

  private readonly flush = () => {
    this.frameId = null;
    let completedTasks = 0;

    while (this.tasks.length > 0 && completedTasks < this.tasksPerFrame) {
      const task = this.tasks.shift();

      if (!task || task.isCancelled) {
        continue;
      }

      task.run();
      completedTasks += 1;
    }

    if (this.tasks.length > 0) {
      this.scheduleFrame();
    }
  };
}
