export class MessageFeedback {
  constructor(
    public readonly id: string,
    public readonly messageId: string,
    public readonly userId: string,
    public readonly type: 'like' | 'dislike',
    public readonly createdAt: Date = new Date()
  ) {}
}

