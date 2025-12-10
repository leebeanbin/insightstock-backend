export class Favorite {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly stockId: string,
    public readonly createdAt: Date
  ) {}
}
