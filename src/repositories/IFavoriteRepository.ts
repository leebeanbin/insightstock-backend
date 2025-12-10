import { Favorite } from '../entities/Favorite';

export interface IFavoriteRepository {
  findAll(userId: string): Promise<Favorite[]>;
  findById(id: string, userId: string): Promise<Favorite | null>;
  findByUserAndStock(userId: string, stockId: string): Promise<Favorite | null>;
  create(favorite: Favorite): Promise<Favorite>;
  delete(id: string): Promise<void>;
}
