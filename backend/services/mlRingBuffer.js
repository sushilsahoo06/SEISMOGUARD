/**
 * RingBuffer - Fixed-capacity circular FIFO memory buffer
 * Used for maintaining real-time sliding windows of sensor readings (e.g., 64-100 samples at 20 Hz).
 */
class RingBuffer {
  constructor(capacity = 64) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  /**
   * Push a new reading into the buffer. Overwrites oldest if full.
   */
  push(item) {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;

    if (this.count < this.capacity) {
      this.count++;
    } else {
      this.tail = (this.tail + 1) % this.capacity;
    }
    return this.count;
  }

  /**
   * Return array of all current samples in chronological order (oldest to newest).
   */
  toArray() {
    const result = new Array(this.count);
    for (let i = 0; i < this.count; i++) {
      result[i] = this.buffer[(this.tail + i) % this.capacity];
    }
    return result;
  }

  /**
   * Return the latest N samples.
   */
  getLatest(n) {
    const k = Math.min(n, this.count);
    const result = new Array(k);
    const startIndex = (this.head - k + this.capacity) % this.capacity;
    for (let i = 0; i < k; i++) {
      result[i] = this.buffer[(startIndex + i) % this.capacity];
    }
    return result;
  }

  size() {
    return this.count;
  }

  isFull() {
    return this.count === this.capacity;
  }

  clear() {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
    this.buffer = new Array(this.capacity);
  }
}

module.exports = RingBuffer;

