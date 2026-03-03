import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Request,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { GameStateService } from '../services';
import type { GameStateData } from '../services';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

interface CustomRequest extends Request {
  user?: { sub: string };
}

@Controller('game-state')
@UseGuards(JwtAuthGuard)
export class GameStateController {
  constructor(private readonly gameStateService: GameStateService) {}

  /**
   * Get the current game state for the authenticated user
   */
  @Get()
  async getGameState(@Request() req: CustomRequest) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    return await this.gameStateService.getGameState(userId);
  }

  /**
   * Save the current game state for the authenticated user
   */
  @Post()
  async saveGameState(
    @Request() req: CustomRequest,
    @Body() gameState: GameStateData,
  ) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    return await this.gameStateService.saveGameState(userId, gameState);
  }

  /**
   * Delete the game state for the authenticated user (when game is completed)
   */
  @Delete()
  async deleteGameState(@Request() req: CustomRequest) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    return await this.gameStateService.deleteGameState(userId);
  }

  /**
   * Check if the user has an active game
   */
  @Get('active')
  async hasActiveGame(@Request() req: CustomRequest) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const hasActiveGame = await this.gameStateService.hasActiveGame(userId);
    return { status: 'ok', hasActiveGame };
  }
}
