export class Conversation {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly title: string,
    public readonly category?: string,
    public readonly tags: string[] = [],
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
    public readonly lastMessage?: string,
    public readonly lastMessageAt?: Date
  ) {}
}
