export class Message {
  constructor(
    public readonly id: string,
    public readonly conversationId: string,
    public readonly userId: string,
    public readonly role: 'user' | 'assistant',
    public readonly content: string,
    public readonly sources: string[],
    public readonly createdAt: Date
  ) {}
}
