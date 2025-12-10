import { FavoriteResponseDto } from '../dto/favorite/FavoriteResponseDto';
import { CreateFavoriteDto } from '../dto/favorite/CreateFavoriteDto';

export interface IFavoriteFacade {
  getFavorites(userId: string): Promise<FavoriteResponseDto[]>;
  addFavorite(userId: string, dto: CreateFavoriteDto): Promise<FavoriteResponseDto>;
  removeFavorite(id: string, userId: string): Promise<void>;
  isFavorited(userId: string, stockId: string): Promise<boolean>;
}
