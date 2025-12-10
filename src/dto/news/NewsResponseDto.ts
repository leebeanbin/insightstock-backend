import { News } from '../../entities/News';

export class NewsResponseDto {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly content: string | null,
    public readonly summary: string | null,
    public readonly source: string,
    public readonly url: string | null,
    public readonly publishedAt: Date,
    public readonly sentiment: string | null,
    public readonly sentimentScore: number | null,
    public readonly thumbnailUrl: string | null,
    public readonly stockCodes: string[]
  ) {}

  static to(news: News, stockCodes: string[] = []): NewsResponseDto {
    return new NewsResponseDto(
      news.id,
      news.title,
      news.content,
      news.summary,
      news.source,
      news.url,
      news.publishedAt,
      news.sentiment,
      news.sentimentScore,
      news.thumbnailUrl,
      stockCodes
    );
  }
}

