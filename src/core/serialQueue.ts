// FTP commands must complete one at a time on each connection.
export default class SerialQueue {
  private tail: Promise<void> = Promise.resolve();

  add<T>(task: () => T | PromiseLike<T>): Promise<T> {
    const result = this.tail.then(task);
    // A failed operation must not prevent subsequent commands from running.
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}
