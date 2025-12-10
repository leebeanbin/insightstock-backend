export class History {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly stockId: string,
    public readonly type: string,
    public readonly viewedAt: Date
  ) {}
}
