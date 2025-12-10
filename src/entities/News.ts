export class News {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly content: string,
    public readonly summary: string | null,
    public readonly source: string,
    public readonly url: string | null,
    public readonly publishedAt: Date,
    public readonly sentiment: string | null,
    public readonly sentimentScore: number | null,
    public readonly thumbnailUrl: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}

